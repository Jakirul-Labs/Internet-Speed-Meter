# Pulse — Real Network Speed Test

এটি একটি বাস্তব Internet Speed Test Website। Download, Upload, latency ও jitter মাপার জন্য Cloudflare-এর official `@cloudflare/speedtest` measurement engine ব্যবহার করা হয়েছে।

## কী কী আছে

- Real download ও upload measurement
- Idle ping / latency ও jitter
- Live circular speedometer ও throughput graph
- Public IP, ISP ও আনুমানিক location lookup
- Browser-এ local test history
- Responsive dark UI
- কোনো hard-coded/demo speed result নেই

## প্রয়োজন

1. Windows 10/11 বা macOS/Linux
2. Node.js 20.19+ বা 22.12+
3. Internet connection

Node.js: [https://nodejs.org/](https://nodejs.org/)

## Windows-এ চালানোর নিয়ম

1. ZIP ফাইল Extract করুন।
2. Extract করা `real-network-speed-test` folder খুলুন।
3. Folder-এর address bar-এ `cmd` লিখে Enter চাপুন (অথবা Terminal খুলুন)।
4. নিচের command দুটো একে একে চালান:

```bash
npm install
npm run dev
```

5. Terminal-এ দেখানো local URL  Chrome-এ খুলুন।
6. **Start speed test** চাপুন।

পরের বার চালাতে শুধু folder-এর ভিতরে `npm run dev` চালালেই হবে।

## Production build (ঐচ্ছিক)

```bash
npm run build
npm run preview
```

## Measurement ও সততার নোট

- Download/Upload/Ping/Jitter Cloudflare-এর edge network-এ real browser requests দিয়ে মাপা হয়। এটি localhost server-এর speed নয়।
- ফলাফল Cloudflare-এর সঙ্গে আপনার ISP route, Wi-Fi, device, browser, congestion এবং test-এর সময়ের ওপর নির্ভর করে। অন্য Speedtest service-এর ফল একদম একই নাও হতে পারে।
- Cloudflare-এর official engine-এর default measurement sequence ব্যবহৃত হয়েছে। Packet loss এই build-এ **N/A/অনুপস্থিত** রাখা হয়েছে, কারণ official engine-এ packet loss-এর জন্য আলাদা WebRTC TURN server ও credentials configure করতে হয়। অনুমান করে 0% দেখানো হয় না।
- Public IP/ISP/location আলাদা `ipwho.is` lookup service থেকে আসে। Lookup ব্যর্থ হলে “Unavailable” দেখাবে।
- Test চালালে measurement requests Cloudflare-এ যায়। Cloudflare-এর README অনুযায়ী test results তাদের aggregate Internet quality insights-এর জন্য সংগ্রহ করা হতে পারে: [https://github.com/cloudflare/speedtest](https://github.com/cloudflare/speedtest)
- Test চলাকালে অন্য download/upload বন্ধ রাখলে তুলনামূলক পরিষ্কার ফল পাওয়া যায়।

## Troubleshooting

- `npm is not recognized`: Node.js install করে Terminal/Command Prompt বন্ধ করে আবার খুলুন।
- Test-এ error/CORS দেখালে browser extension/ad blocker/VPN বন্ধ করে আবার চেষ্টা করুন; কিছু network বা browser policy external measurement আটকাতে পারে।
- ISP/Network lookup না এলে IP lookup service সাময়িক unavailable হতে পারে; speed test আলাদাভাবে কাজ করতে পারে।
- Browser tab active রাখুন; background tab throttling test-কে প্রভাবিত করতে পারে।
