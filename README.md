# Mirai Source Code & Dashboard Project

This repository is based on the [Mirai Source Code by jgamblin](https://github.com/jgamblin/mirai-source-code). 

We are currently building and integrating a **Dashboard** to manage and visualize the botnet simulation for our cybersecurity laboratory (RedXBlue Botnet Simulation).

## ⚠️ CRITICAL DISCLAIMER

This repository contains the leaked source code of the **Mirai botnet**, originally created to infect IoT devices and launch large-scale DDoS attacks. This code and the accompanying dashboard are provided **strictly for cybersecurity research, reverse engineering, malware analysis, and detection development purposes only in an isolated lab environment**.

**⚠️ WARNING: Do not use this code to attack or scan any real devices or networks. Unauthorized use is illegal.**

## 🔧 Requirements

Before building and running this code, ensure you have the following installed on a **Linux host**:

- `gcc` - GNU Compiler Collection
- `golang` - Go programming language
- `electric-fence` - Memory debugging library
- `mysql-server` - MySQL database server
- `mysql-client` - MySQL database client
- `build-essential` - Essential build tools
- `crossbuild-essential-armel` - Cross-compilation tools for ARM

## 📁 Repository Structure

- `mirai/` - Core malware source code (bot + CnC server)
- `loader/` - Infects vulnerable devices using telnet brute-force
- `dlr/` - Payload delivery support
- `dashboard/` - **[NEW]** Web dashboard for visualizing the botnet and lab environment
- `scripts/` - Scripts for building and managing the malware

## 📚 References

- [Original Mirai Source Code by jgamblin](https://github.com/jgamblin/mirai-source-code)
