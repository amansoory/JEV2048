# Oracle Cloud VM and Vercel setup

Repository: https://github.com/amansoory/JEV2048
No UI changes or external deployment are part of this preparation. Do not enable hosted n-tuple until the target VM passes the fixed-board parity check below.

## VM selection

Create **VM.Standard.A1.Flex, 1 OCPU, 6 GB RAM**, **Ubuntu 24.04 LTS aarch64**, and a **50 GB boot volume**, in the tenancy's home region. Choose the image/shape explicitly marked Always Free eligible, a public subnet, and a public IPv4 address. Preserve the private SSH key yourself. No GPU, load balancer or extra storage is needed. Build on the VM; the Windows executable and existing amd64 Docker image cannot run natively on A1.

Oracle's current documentation lists a tenancy-wide A1 allowance of 2 OCPUs and 12 GB and 200 GB total boot/block storage. Other existing resources count toward those totals. Verify the console's eligibility and cost estimate before creating anything; capacity is not guaranteed. Idle Always Free VMs can be reclaimed. This is not guaranteed always-on hosting. The small evaluator will often be idle; do not generate artificial load to avoid reclamation.

Source checked 2026-09-18: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Networking

Create these **stateful ingress rules** in the instance's OCI Network Security Group or subnet Security List:

| Protocol / destination port | Source | Purpose |
| --- | --- | --- |
| TCP 22 | Your administrator public IP /32 | SSH only |
| TCP 80 | 0.0.0.0/0 | ACME certificate validation and HTTPS redirect |
| TCP 443 | 0.0.0.0/0 | Authenticated HTTPS evaluator |

Do not open 7860. Python binds only to 127.0.0.1:7860. Keep normal outbound DNS/HTTPS access for package/model download and certificate renewal. No IPv6 setup is assumed; do not publish an AAAA record unless you configure IPv6 separately. Vercel egress is not assumed to have a fixed IP, so authentication is by a server-only shared secret over HTTPS.

Set an A record for a hostname you control, such as `ntuple.example.com`, to the VM's public IPv4. Substitute your real hostname everywhere below. The Vercel proxy deliberately rejects plain HTTP for public inference.

On Oracle's Ubuntu image, preserve its existing firewall rules and insert HTTP/HTTPS allowances before the existing reject rule:

```sh
sudo apt-get update
sudo apt-get install -y git g++ make python3 nginx certbot python3-certbot-nginx iptables-persistent
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

If you already manage this VM with UFW or another firewall, add equivalent 80/443 rules through that tool instead; do not maintain two competing rule sets or flush OCI's existing rules. Keep SSH restricted in OCI while setting up TLS.

## Publish source and build

First push this prepared revision from the local app repository, after deciding whether a push triggers an existing Vercel deployment:

```powershell
cd C:\Users\ArmanM\jev-2048
git remote -v
git push -u origin HEAD:main
git rev-parse HEAD
```

On the VM, as `ubuntu`:

```sh
git clone https://github.com/amansoory/JEV2048.git ~/JEV2048
cd ~/JEV2048
# Replace this with the exact commit printed by git rev-parse HEAD above.
git checkout YOUR_RELEASE_COMMIT
cd deploy/ntuple
bash build-linux.sh
python3 -m unittest test_server.py
```

The build verifies frozen source, compiles the unchanged native adapter, downloads the official 164,834,696-byte XZ checkpoint, verifies both recorded SHA-256 hashes, and installs the 268,435,545-byte decompressed weights. Allow roughly 1 GB free working space beyond OS/compiler packages. It does not run games. Existing valid weights are reused; mismatch stops setup. Compiler version and executable checksum are written locally and ignored by Git. ARM inference parity must still be checked after startup. Do not change compiler flags, weights or source to hide a mismatch.

## Install the service

```sh
sudo useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin jev-ntuple
sudo install -d -o root -g root -m 755 /opt/jev-ntuple
sudo cp -a . /opt/jev-ntuple/
sudo chown -R root:root /opt/jev-ntuple
sudo chmod -R a+rX /opt/jev-ntuple
sudo test -e /etc/jev-ntuple.env || sudo install -o root -g root -m 600 /dev/null /etc/jev-ntuple.env
sudoedit /etc/jev-ntuple.env
```

Put exactly one secret assignment in that root-only file:

```text
NTUPLE_SERVICE_SECRET=REPLACE_WITH_A_RANDOM_64_CHARACTER_HEX_SECRET
```

Generate/store the real value in your password manager and paste it in the secure editor and Vercel secret field. Do not print it, put it in a command argument, commit the file or include it in screenshots. This instruction does not create a secret during local preparation.

```sh
sudo install -o root -g root -m 644 jev-ntuple.service /etc/systemd/system/jev-ntuple.service
sudo systemd-analyze verify /etc/systemd/system/jev-ntuple.service
sudo systemctl daemon-reload
sudo systemctl enable --now jev-ntuple
sudo systemctl status jev-ntuple --no-pager
curl --fail http://127.0.0.1:7860/health
curl --fail http://127.0.0.1:7860/ready
```

Startup waits for checkpoint verification and native readiness. systemd runs as a dedicated unprivileged user with a read-only filesystem, a 2 GB memory ceiling and no capabilities. Native failure exits the wrapper so systemd can restart it, with at most five starts per five minutes. To inspect failures: `sudo journalctl -u jev-ntuple -n 50 --no-pager`. Logs contain no authorization headers or request bodies.

Run the fixed-board parity smoke test with the secret loaded privately by systemd, not shell arguments:

```sh
sudo systemd-run --wait --pipe --collect --property=EnvironmentFile=/etc/jev-ntuple.env /usr/bin/python3 /opt/jev-ntuple/smoke.py
```

All three expected directions and candidate values must match. This does not run complete games or call Jev. An ARM mismatch is a release blocker, not permission to alter the trained policy. Current parity is verified on local Linux amd64 and Windows only; Oracle ARM is not yet measured.

## HTTPS

Replace the hostname in the Nginx template, then install it:

```sh
NTUPLE_HOST=ntuple.example.com # Replace with your real DNS hostname.
sed "s/ntuple.example.com/$NTUPLE_HOST/g" nginx.conf | sudo tee /etc/nginx/sites-available/jev-ntuple >/dev/null
sudo ln -s /etc/nginx/sites-available/jev-ntuple /etc/nginx/sites-enabled/jev-ntuple
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx --redirect -d "$NTUPLE_HOST"
sudo certbot renew --dry-run
curl --fail "https://$NTUPLE_HOST/ready"
```

Use Certbot's interactive contact/terms prompts. Its Nginx integration adds the TLS listener and HTTP redirect. Do not enable Vercel traffic before the trusted HTTPS certificate works. The Nginx template bounds body/header time, upstream time and per-IP request/concurrency rates. The application still enforces authentication, shape checks and native request limits.

For end-to-end parity through HTTPS, run the same smoke test with an additional nonsecret environment setting:

```sh
sudo systemd-run --wait --pipe --collect --property=EnvironmentFile=/etc/jev-ntuple.env --setenv="NTUPLE_TEST_URL=https://$NTUPLE_HOST" /usr/bin/python3 /opt/jev-ntuple/smoke.py
```

## Vercel

Import `amansoory/JEV2048` as a **Next.js** project with repository root as Root Directory. Keep `npm run build` as Build Command. In **Project Settings → Environment Variables**, set these for the intended environment:

- `NTUPLE_SERVICE_URL=https://YOUR_REAL_NTUPLE_HOST`
- `NTUPLE_SERVICE_SECRET`: the exact value in `/etc/jev-ntuple.env`.
- Existing `TYPESAFE_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- `PUBLIC_DAILY_JEV_CALLS=1000` or your chosen budget; `0` disables public Jev calls.

Only the Turnstile site key is public. Never prefix service credentials with `NEXT_PUBLIC_`. The browser calls Next.js, which validates the board, checks shared protection, sends the secret header, applies a 12-second timeout and validates the response. Local Windows mode is retained by leaving `NTUPLE_SERVICE_URL` unset locally. Hosted Ultra is still disabled.

After deployment is authorized, sign in and deploy the unchanged frontend:

```powershell
npx vercel@latest login
npx vercel@latest link
npx vercel@latest --prod
```

A GitHub push can also trigger an already-connected Vercel project. Do not push merely as a workaround for a no-deployment instruction. No Vercel/Oracle resources have been created by these instructions.

## Operations and limitations

The 32,768 native encoding limit is unchanged; a board requiring a 65,536 outcome fails explicitly. No model substitution or public remote batching. The small service makes no upstream API calls. Shared visitor limits and the Jev daily budget remain in Next.js/Upstash, not in-memory VM counters. API health does not prove Oracle capacity, certificate renewal or uptime guarantees.

For upgrades, stop the unit, preserve `/etc/jev-ntuple.env` and verified weights, install one tested source revision, and restart. Do not overwrite code under a running worker. Roll back the service and Vercel to compatible verified revisions. Rotate the secret on both sides together. Oracle may reclaim idle free VMs; keep source and checkpoint provenance off-VM, and point DNS/Vercel at a replacement only after it passes parity. This is an availability limitation of the free host, not a reason to falsify native responses.
