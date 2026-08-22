$file = "z:\Univ\CyberModule\Mirai-Source-Code\dashboard\version2\backend\cnc_client.py"
$content = Get-Content $file -Raw
$content = $content -replace "def count_tcp_peers\(self\) -> int:", "def get_tcp_peers(self) -> List[str]:"
$content = $content -replace "return -1", "return []"
$content = $content -replace "return len\(peers\)", "return list(peers)"
$content = $content -replace "peers = self\.count_tcp_peers\(\)", "peers = self.get_tcp_peers()"
$content = $content -replace '"tcp_peers": peers,', '"tcp_peers": len(peers), "peer_ips": peers,'
Set-Content -Path $file -Value $content -Encoding UTF8
Write-Host "Updated cnc_client.py"
