# 🦈 Wireshark Traffic Capture & Analysis Guide

During your presentation, you want to show the **live network traffic** of every phase of the botnet lifecycle. This guide explains how to stream traffic from your Proxmox server directly into Wireshark on your laptop, along with the exact filters to use for each phase.

---

## 🛠️ Part 1: Prerequisites & Setup

Since all virtual machine interfaces and VLANs are connected to the bridge `vmbr1` on Proxmox, you can capture all inter-VLAN traffic by sniffing on this interface.

### Step 1: Install `tshark` on Proxmox
Log in to your Proxmox Shell (via SSH or GUI Console) and run:
```bash
apt update && apt install tshark -y
```

### Step 2: Configure Passwordless SSH (Recommended)
To prevent the terminal from prompting for a password (which breaks the pipeline/Wireshark trigger), configure SSH Key authentication:

#### 🪟 Windows Setup (Command Prompt - CMD):
1. Create your local SSH Key:
   ```cmd
   ssh-keygen -t ed25519
   ```
   *(Press **Enter** to accept all default paths and empty passwords)*
2. Send the key to Proxmox:
   ```cmd
   ssh root@<IP_Proxmox> "mkdir -p ~/.ssh"
   type %userprofile%\.ssh\id_ed25519.pub | ssh root@<IP_Proxmox> "cat >> ~/.ssh/authorized_keys"
   ```

#### 🍎 macOS & 🐧 Linux Setup:
1. Create your local SSH Key:
   ```bash
   ssh-keygen -t ed25519
   ```
   *(Press **Enter** to accept defaults)*
2. Send the key to Proxmox:
   ```bash
   ssh-copy-id root@<IP_Proxmox>
   ```

---

## 🚀 Part 2: Running the Packet Stream Command

Once your SSH keys are set up, run the corresponding command below depending on your operating system:

### 🪟 Windows (Command Prompt - CMD)
```cmd
ssh -T -o StrictHostKeyChecking=no root@<IP_Proxmox> "tshark -i vmbr1 -f \"not port 22\" -w -" | "C:\Program Files\Wireshark\wireshark.exe" -k -i -
```

### 🍎 macOS
```bash
ssh -T -o StrictHostKeyChecking=no root@<IP_Proxmox> "tshark -i vmbr1 -f \"not port 22\" -w -" | /Applications/Wireshark.app/Contents/MacOS/Wireshark -k -i -
```

### 🐧 Linux (e.g., Ubuntu, Debian)
```bash
ssh -T -o StrictHostKeyChecking=no root@<IP_Proxmox> "tshark -i vmbr1 -f \"not port 22\" -w -" | wireshark -k -i -
```

> [!IMPORTANT]
> **Why `-f "not port 22"` is mandatory:** If you do not exclude port 22, Wireshark will capture the SSH connection packets that are sending the capture stream to your laptop. This creates an infinite packet loop (SSH storm) that will flood the interface and show no actual VM traffic.

---

## 🔍 Troubleshooting: Why is my capture empty?

If you run the command and see no packets at all, check the following three fixes:

### Fix 1: Ensure the Bridge Interface is "UP"
Since `vmbr1` does not have an IP address assigned to the Proxmox host itself, the Linux kernel might keep the bridge interface state as `DOWN`. Run this command in the **Proxmox shell** to force the bridge to start capturing:
```bash
ip link set vmbr1 up
```

### Fix 2: Sniff the pfSense LAN Interface Directly (Recommended)
Because pfSense routes all traffic between the VLANs, every packet *must* pass through the pfSense LAN port. We can sniff this specific virtual port on Proxmox.
1. Find your pfSense VM ID (e.g., `100` or `101`).
2. The network cards on Proxmox are named `tap[VMID]i[Interface_Index]`.
   - If pfSense is VM `101`, and the LAN interface (`vmbr1`) is the second network device in the VM hardware settings (`net1`), the interface name on Proxmox is **`tap101i1`**.
3. Run the capture command targeting that specific tap port:
   ```bash
   ssh -T -o StrictHostKeyChecking=no root@<IP_Proxmox> "tshark -i tap101i1 -w -" | "C:\Program Files\Wireshark\wireshark.exe" -k -i -
   ```

### Fix 3: Sniff "any" Interface
If you're unsure which bridge or tap interface is active, you can capture on all interfaces simultaneously while filtering out your SSH connection:
```bash
ssh -T -o StrictHostKeyChecking=no root@<IP_Proxmox> "tshark -i any -f \"not port 22\" -w -" | "C:\Program Files\Wireshark\wireshark.exe" -k -i -
```



---

## 🔬 Part 2: Wireshark Filters for Each Phase

To show the sequence of events clearly during the 15-minute presentation, keep these filters ready to apply in the Wireshark filter bar:

### 🔄 Phase 1: Propagation (Worm Scanning & Brute-force)
The infected bots (`Bot-A1`, `Bot-B1`, etc.) will start scanning random IPs and attempting to brute-force telnet ports (`23` and `22`).
* **Wireshark Filter:**
  ```text
  tcp.port == 23 or tcp.port == 22
  ```
* **What it shows:** You will see a flood of `SYN` requests originating from the bot IPs (`110.164.20.11`, `125.20.30.11`) looking for active telnet connections, followed by credentials brute-forcing attempts.

---

### 💓 Phase 2: Bot Heartbeats (Keeping C2 Connected)
Once a bot is running, it constantly sends keep-alive/heartbeat messages to the C2 Server so the attacker knows it is online.
* **Wireshark Filter:**
  ```text
  ip.addr == 185.10.20.100 && !(tcp.port == 80)
  ```
* **What it shows:** Steady TCP packets flowing between the bot IPs and the C2 server (`185.10.20.100`) on the custom Mirai listener port.

---

### 📣 Phase 3: C2 Command Transmission (The Trigger)
When the attacker clicks "Launch Attack" on the dashboard, the backend logs in via Telnet to the C2 server to issue the attack instruction.
* **Wireshark Filter:**
  ```text
  tcp.port == 23 && ip.addr == 185.10.20.100
  ```
* **What it shows:** The dashboard server backend sending command text payloads (e.g. `udp 203.0.113.100 10`) to the C2 server, which then propagates to the bots.

---

### 🌊 Phase 4: DDoS Attack Storm (The Flood)
The bots collectively flood the target servers.
* **Wireshark Filter (Targeting Singapore):**
  ```text
  ip.dst == 203.0.113.100
  ```
* **Wireshark Filter (Targeting South Korea):**
  ```text
  ip.dst == 210.89.0.100
  ```
* **What it shows:** A massive storm of UDP, TCP SYN, or HTTP request packets converging on the target IP simultaneously from different bot IPs (`110.164.20.x`, `66.249.64.x`, etc.), exhausting the victim's resources.

---

### 🛡️ Phase 5: Blue Team Mitigation (Firewall Drop)
The defender configures a firewall rule on pfSense to drop traffic from the C2 server network (`185.10.20.0/24`).
* **Wireshark Filter:**
  ```text
  ip.src == 185.10.20.0/24
  ```
* **What it shows:** After the drop rule is applied, traffic from the C2 server completely stops. The bots stop receiving new attack instructions, and target flood packets instantly drop to zero.

* <img width="1168" height="784" alt="image" src="https://github.com/user-attachments/assets/a61de5c1-e1fb-454f-b0c1-afed8da25e81" />

