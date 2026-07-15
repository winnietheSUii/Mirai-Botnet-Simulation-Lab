# 🛡️ Proxmox Virtual Lab Setup Guide: RedXBlue Botnet Simulation
**Course Project:** 240-353 Cybersecurity Officer Module  
**Hardware Specs:** ThinkCentre M710q (4 Cores / 8 Threads CPU, 16GB RAM, 512GB SSD)

This guide provides step-by-step instructions to design and provision a **production-grade virtualized laboratory** for the **R@NS0M D-D0S (Mirai Botnet)** demonstration. To match real-world botnet architecture, we isolate the **C2 Server** and the **Loader Server** into separate machines and subnets.

---

## 📐 Network & Architecture Topology

We segment the laboratory into 6 isolated VLAN subnets using a single Virtual Switch (`vmbr1`) in Proxmox and a virtualized **pfSense** router.

```
                      +-------------------+
                      |   Proxmox Host    |
                      |   (Bridge vmbr1)  |
                      +---------+---------+
                                |
                      +---------v---------+
                      |   pfSense VM      | (Router / Firewall / DHCP)
                      |   Routing Engine  |
                      +----+--+-+--+----+--+
                           |  | |  |    |
       +-------------------+  | |  |    +-------------------+
       |                      | |  +-----------------+      |
       |                      | |                    |      |
+------v------+         +-----v-v-----+        +-----v------+
| Attacker C2 |         | Corp A LAN  |        | Target SG  |
|  (VLAN 10)  |         |  (VLAN 20)  |        |  (VLAN 40) |
| 185.10.20.0 |         |110.164.20.0 |        |203.0.113.0 |
+-------------+         +-------------+        +------------+
       |                      |                      |
+------v------+         +-----v-----+          +-----v-----+
|   Loader    |         | Corp B LAN|          | Target KR  |
|  (VLAN 15)  |         |  (VLAN 30)|          |  (VLAN 50) |
| 185.10.30.0 |         |66.249.64.0|          |210.89.0.0  |
+-------------+         +-----------+          +------------+
```

| Network Zone | Role / Description | VLAN Tag | Subnet | Gateway IP | Node IP Range |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Attacker C2** | Hacker Control Center & Web UI | **10** | `185.10.20.0/24` | `185.10.20.1` | `185.10.20.100` |
| **Loader Server** | Binary Delivery Web Host | **15** | `185.10.30.0/24` | `185.10.30.1` | `185.10.30.100` |
| **Corp A (TH 🇹🇭)** | Infected IoT Nodes Cluster 1 | **20** | `110.164.20.0/24` | `110.164.20.1` | `110.164.20.11` to `.12` |
| **Corp B (US 🇺🇸)** | Infected IoT Nodes Cluster 2 | **30** | `66.249.64.0/24` | `66.249.64.1` | `66.249.64.11` to `.12` |
| **Target SG (🇸🇬)** | Public Cloud Web Server Target | **40** | `203.0.113.0/24` | `203.0.113.1` | `203.0.113.100` |
| **Target KR (🇰🇷)** | E-Commerce Server Target | **50** | `210.89.0.0/24` | `210.89.0.1` | `210.89.0.100` |

---

## 🖥️ Node Resource Allocation (RAM, Storage, CPU)

To avoid overloading the **ThinkCentre M710q (16GB RAM)**, we allocate resources carefully. Proxmox VE itself uses ~1.5 GB RAM.

| VM / LXC Name | ID | OS / Template | Resource Allocation (vCPU / RAM / Disk) | Core Software component |
| :--- | :--- | :--- | :--- | :--- |
| **pfSense** | `100` | FreeBSD (ISO) | 1 Cores / **1 GB RAM** / 8 GB Disk | Virtual Router & Firewall rules |
| **Attacker-C2** | `102` | Ubuntu 24.04 LXC | 1 Cores / **1.5 GB RAM** / 15 GB Disk | Mirai CNC (`mirai/cnc`), Database, Flask Web UI |
| **Loader-Server** | `103` | Ubuntu 24.04 LXC | 1 Cores / **1 GB RAM** / 10 GB Disk | Mirai Loader Daemon (`loader`), HTTP File Server |
| **Bot-TH1** | `201` | Alpine Linux LXC | 1 Core / **128 MB RAM** / 2 GB Disk | Infected Bot Daemon (`mirai/bot`) |
| **Bot-TH2** | `202` | Alpine Linux LXC | 1 Core / **128 MB RAM** / 2 GB Disk | Infected Bot Daemon (`mirai/bot`) |
| **Bot-US1** | `301` | Alpine Linux LXC | 1 Core / **128 MB RAM** / 2 GB Disk | Infected Bot Daemon (`mirai/bot`) |
| **Target-SG** | `401` | Ubuntu 24.04 LXC | 1 Core / **1 GB RAM** / 8 GB Disk | Nginx Web Server (Victim host) |
| **Target-KR** | `501` | Ubuntu 24.04 LXC | 1 Core / **1 GB RAM** / 8 GB Disk | Nginx Web Server (Victim host) |
| **TOTALS** | — | — | **8 Cores / 6.0 GB RAM / 49 GB Disk** | *Safely fits inside 16GB RAM limit* |

---

## 🛠️ Step-by-Step Provisioning Guide

### Step 0: Create the Virtual Switch in Proxmox
1. Log into your **Proxmox Web GUI**.
2. Go to **[Your Node]** -> **System** -> **Network**.
3. Click **Create** -> **Linux Bridge**.
   - **Name:** `vmbr1`
   - **VLAN Aware:** Check this box `[X]` (Allows tagging `10`, `15`, `20`, `30`, `40`, `50`).
4. Click **Apply Configuration**.

---

### Step 1: Install & Configure pfSense VM
1. Click **Create VM**: ID `100`, Name: `pfSense-Router`. Assign 1 Core, 1024 MB RAM.
2. Under **Network**:
   - Device 1 (WAN): Bridge `vmbr0` (for setup and administration).
   - Device 2 (LAN): Bridge `vmbr1` (VLAN Aware).
3. In pfSense Console, set LAN to parent interface `vtnet1`.
4. Inside pfSense Web Interface (**Interfaces -> Assignments -> VLANs**), add VLANs:
   - **VLAN 10** (Attacker C2): IP `185.10.20.1/24`
   - **VLAN 15** (Loader Server): IP `185.10.30.1/24`
   - **VLAN 20** (Corp A): IP `110.164.20.1/24`
   - **VLAN 30** (Corp B): IP `66.249.64.1/24`
   - **VLAN 40** (Target SG): IP `203.0.113.1/24`
   - **VLAN 50** (Target KR): IP `210.89.0.1/24`
5. Go to **Interfaces -> Assignments**, enable all VLANs, and configure Static IPv4 addresses matching the list above.
6. Disable the default rule blocking private/bogon networks under each interface configuration page.

---

### Step 2: Configure the C2 Server (VLAN 10)
1. Create an Ubuntu 24.04 LXC, ID `102`, Name `Attacker-C2`.
2. **Network settings:**
   - Bridge: `vmbr1`
   - VLAN Tag: `10`
   - IPv4/CIDR: `185.10.20.100/24`
   - Gateway: `185.10.20.1`

---

### Step 3: Configure the Loader Server (VLAN 15)
1. Create an Ubuntu 24.04 LXC, ID `103`, Name `Loader-Server`.
2. **Network settings:**
   - Bridge: `vmbr1`
   - VLAN Tag: `15`
   - IPv4/CIDR: `185.10.30.100/24`
   - Gateway: `185.10.30.1`

---

### Step 4: Configure the Bot Clusters (VLAN 20 & 30)
We run Alpine Linux LXCs to keep memory usage minimal:
1. **Bot-TH1 (LXC ID 201):**
   - Bridge: `vmbr1`, VLAN Tag: `20`
   - IPv4/CIDR: `110.164.20.11/24`, Gateway: `110.164.20.1`
   - Setup vulnerable telnet daemon: `apk update && apk add busybox-extras && inetd`
2. **Clone for Bot-TH2 (LXC ID 202):**
   - IP: `110.164.20.12/24`
3. **Clone for Bot-US1 (LXC ID 301):**
   - VLAN Tag: `30`
   - IPv4/CIDR: `66.249.64.11/24`, Gateway: `66.249.64.1`

---

### Step 5: Configure Target Web Servers (VLAN 40 & 50)
1. **Target-SG (LXC ID 401):**
   - Bridge: `vmbr1`, VLAN Tag: `40`
   - IPv4/CIDR: `203.0.113.100/24`, Gateway: `203.0.113.1`
   - Install Web Server: `apt update && apt install nginx -y`
2. **Target-KR (LXC ID 501):**
   - Bridge: `vmbr1`, VLAN Tag: `50`
   - IPv4/CIDR: `210.89.0.100/24`, Gateway: `210.89.0.1`
   - Install Web Server: `apt update && apt install nginx -y`
