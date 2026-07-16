# 🛡️ Proxmox Virtual Lab Setup Guide: RedXBlue Botnet Simulation
**Course Project:** 240-353 Cybersecurity Officer Module  
**Hardware Specs:** ThinkCentre M710q (4 Cores / 8 Threads CPU, 16GB RAM, 512GB SSD)

This guide provides step-by-step instructions to design and provision a **production-grade virtualized laboratory** for the **R@NS0M D-D0S (Mirai Botnet)** demonstration. To match real-world botnet architecture, we isolate the **C2 Server** and the **Loader Server** into separate machines and subnets.

---

## 📐 Network & Architecture Topology

We segment the laboratory into isolated VLAN subnets using a single Virtual Switch (`vmbr1`) in Proxmox and a virtualized **pfSense** router.

| Group / Zone | Type | VLAN Tag | Subnet | Gateway IP (pfSense) | Node IP Allocation | Location / Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Attacker 1** | Loader + C2 | **10** | `185.10.20.0/24` | `185.10.20.1` | C2: `.100`, Loader: `.200` | จากรูป (วง 1) |
| **Bot 1** | IoT Bot | **20** | `110.164.20.0/24` | `110.164.20.1` | `.11`, `.12` | จากรูป (วง 2) - ไทย |
| **Bot 2** | IoT Bot | **21** | `125.20.30.0/24` | `125.20.30.1` | `.11`, `.12` | จากรูป (วง 3) - ไทย |
| **Bot 3** | Bot | **30** | `66.249.64.0/24` | `66.249.64.1` | `.100` | Public IP - สหรัฐฯ |
| **Bot 4** | Bot | **31** | `210.89.0.0/24` | `210.89.0.1` | `.100` | Public IP - เกาหลีใต้ |
| **Bot 5** | Bot | **32** | `114.240.0.0/24` | `114.240.0.1` | `.100` | Public IP - จีน |
| **Bot 6** | Bot | **33** | `95.24.0.0/24` | `95.24.0.1` | `.100` | Public IP - รัสเซีย |
| **Bot 7** | Bot | **34** | `46.112.0.0/24` | `46.112.0.1` | `.100` | Public IP - เยอรมนี |
| **Bot 8** | Bot | **35** | `177.0.0.0/24` | `177.0.0.1` | `.100` | Public IP - บราซิล |
| **Bot 9** | Bot | **36** | `8.2.0.0/24` | `8.2.0.1` | `.100` | Public IP - อังกฤษ |
| **Bot 10** | Bot | **37** | `1.0.1.0/24` | `1.0.1.1` | `.100` | Public IP - เอเชีย |
| **Victim 1** | Target | **40** | `12.1.2.0/24` | `12.1.2.1` | `.100` | Public IP - สหรัฐอเมริกา (AT&T) |
| **Victim 2** | Target | **41** | `202.97.0.0/24` | `202.97.0.1` | `.100` | Public IP - จีน (China Telecom) |
| **Victim 3** | Target | **42** | `217.107.0.0/24` | `217.107.0.1` | `.100` | Public IP - รัสเซีย (Rostelecom) |
| **Victim 4** | Target | **43** | `175.45.176.0/24` | `175.45.176.1` | `.100` | Public IP - เกาหลีเหนือ (Star JV) |
| **Victim 5** | Target | **44** | `5.200.0.0/24` | `5.200.0.1` | `.100` | Public IP - อิหร่าน (TCI) |

---

## 🖥️ Node Resource Allocation (RAM, Storage, CPU)

เพื่อความประหยัดทรัพยากรบนเครื่อง ThinkCentre M710q (16GB RAM) เราจะจัดสรรทรัพยากรดังนี้:

| VM / LXC Name | ID | OS / Template | Resource Allocation | Role / Software |
| :--- | :--- | :--- | :--- | :--- |
| **pfSense** | `100` | FreeBSD | 1 Core / 1 GB RAM / 8 GB Disk | Virtual Router & Gateway |
| **Attacker-C2** | `102` | Ubuntu LXC | 1 Core / 1.5 GB RAM / 15 GB Disk | Mirai CNC (`mirai/cnc`) |
| **Loader-Server** | `103` | Ubuntu LXC | 1 Core / 1 GB RAM / 10 GB Disk | Mirai Loader (`loader`) |
| **Bot-1 (TH1)** | `201` | Alpine LXC | 1 Core / 128 MB RAM / 2 GB Disk | Infected IoT Bot |
| **Bot-2 (TH2)** | `202` | Alpine LXC | 1 Core / 128 MB RAM / 2 GB Disk | Infected IoT Bot |
| **Bot-3 (US)** | `301` | Alpine LXC | 1 Core / 128 MB RAM / 2 GB Disk | Infected Bot |
| **Victim-1 (US)** | `401` | Ubuntu LXC | 1 Core / 1 GB RAM / 8 GB Disk | Target Web Server |
| **Victim-2 (CN)** | `402` | Ubuntu LXC | 1 Core / 1 GB RAM / 8 GB Disk | Target Web Server |

---

## 🛠️ Step-by-Step Provisioning Guide

### Step 0: Create the Virtual Switch in Proxmox
1. เข้าไปที่ **Proxmox Web GUI**
2. เลือก node ของคุณ -> **System** -> **Network**
3. คลิก **Create** -> **Linux Bridge**
   - **Name:** `vmbr1`
   - **VLAN Aware:** Check `[X]`
4. คลิก **Apply Configuration**

### Step 1: Install & Configure pfSense VM
1. สร้าง pfSense VM (ID 100)
2. เพิ่ม Network Interface:
   - Interface 1: `vmbr0` (WAN)
   - Interface 2: `vmbr1` (LAN - VLAN Aware)
3. ใน pfSense Web GUI ให้เพิ่ม VLAN interfaces ตามตารางข้างบน (VLAN 10, 20, 21, 30-37, 40-44) พร้อมเปิดใช้ DHCP Server หรือตั้งเป็น Static IP ตามความต้องการ

### Step 2: Configure the C2 & Loader Server (VLAN 10)
1. **C2 Server (ID 102):**
   - Bridge: `vmbr1`, VLAN Tag: `10`
   - IPv4: `185.10.20.100/24`, Gateway: `185.10.20.1`
2. **Loader Server (ID 103):**
   - Bridge: `vmbr1`, VLAN Tag: `10`
   - IPv4: `185.10.20.200/24`, Gateway: `185.10.20.1`

### Step 3: Configure Bot Nodes
1. **Bot-1 (ID 201):** Bridge: `vmbr1`, VLAN Tag: `20`, IPv4: `110.164.20.11/24`, Gateway: `110.164.20.1`
2. **Bot-2 (ID 202):** Bridge: `vmbr1`, VLAN Tag: `21`, IPv4: `125.20.30.11/24`, Gateway: `125.20.30.1`
3. **Bot-3 (ID 301):** Bridge: `vmbr1`, VLAN Tag: `30`, IPv4: `66.249.64.100/24`, Gateway: `66.249.64.1`

### Step 4: Configure Victim Targets
1. **Victim-1 (ID 401):** Bridge: `vmbr1`, VLAN Tag: `40`, IPv4: `12.1.2.100/24`, Gateway: `12.1.2.1`
2. **Victim-2 (ID 402):** Bridge: `vmbr1`, VLAN Tag: `41`, IPv4: `202.97.0.100/24`, Gateway: `202.97.0.1`
