package main

import (
    "net"
    "time"
    "io"
)

type Bot struct {
    uid     int
    conn    net.Conn
    version byte
    source  string
}

func NewBot(conn net.Conn, version byte, source string) *Bot {
    return &Bot{-1, conn, version, source}
}

func (this *Bot) Handle() {
    clientList.AddClient(this)
    defer clientList.DelClient(this)

    buf := make([]byte, 2)
    for {
        this.conn.SetDeadline(time.Now().Add(180 * time.Second))
        if _, err := io.ReadFull(this.conn, buf); err != nil {
            return
        }
        if _, err := this.conn.Write(buf); err != nil {
            return
        }
    }
}

func (this *Bot) QueueBuf(buf []byte) {
    this.conn.Write(buf)
}
