# Pulse — Real Network Speed Test

এটি একটি বাস্তব Internet Speed Test Website। Download, Upload, Latency ও Jitter মাপার জন্য Cloudflare-এর official `@cloudflare/speedtest` measurement engine ব্যবহার করা হয়েছে।

## কী কী আছে

- Real download ও upload measurement
- Idle ping / latency ও jitter
- Live circular speedometer ও throughput graph
- Public IP, ISP ও আনুমানিক location lookup
- Browser-এ local test history
- Responsive UI
- কোনো hard-coded/demo speed result নেই

## প্রয়োজনীয় Software

1. Windows 10/11 অথবা macOS/Linux
2. Node.js 20.19+ অথবা 22.12+
3. Internet connection

Node.js: https://nodejs.org/

## GitHub থেকে Project Download করার নিয়ম

১. GitHub-এ Pulse Project-এর Repository খুলুন।

২. Repository পেজে সবুজ **Code** বাটনে ক্লিক করুন।

৩. **Download ZIP** নির্বাচন করুন।

৪. ZIP ফাইলটি Download হলে Extract করুন।

৫. Extract করা Project Folder খুলুন।

৬. Folder-এর address bar-এ `cmd` লিখে Enter চাপুন। অথবা Terminal খুলুন।

৭. নিচের Command দুটো একে একে চালান:

```bash
npm install
npm run dev
```

৮. Terminal-এ প্রদর্শিত Local URL কপি করে Chrome বা অন্য Browser-এ খুলুন।

৯. **Run speed test** বাটনে ক্লিক করে Test শুরু করুন।

## পরবর্তী সময়ে Project চালানোর নিয়ম

প্রথমবার `npm install` করার পর প্রতিবার নতুন করে Install করার প্রয়োজন নেই।

শুধু Project Folder-এর ভিতরে Terminal খুলে চালান:

```bash
npm run dev
```

## Production Build (ঐচ্ছিক)

Production-এর জন্য Build তৈরি করতে:

```bash
npm run build
npm run preview
```

## Measurement ও সততার নোট

- Download, Upload, Ping ও Jitter Cloudflare-এর Edge Network-এ real browser requests দিয়ে মাপা হয়। এটি localhost server-এর speed নয়।
- ফলাফল Cloudflare-এর সঙ্গে আপনার ISP route, Wi-Fi, device, browser, network congestion এবং test-এর সময়ের ওপর নির্ভর করে। অন্য Speedtest service-এর ফল একদম একই নাও হতে পারে।
- Cloudflare-এর official engine-এর default measurement sequence ব্যবহৃত হয়েছে। Packet loss এই build-এ **N/A/অনুপস্থিত** রাখা হয়েছে, কারণ official engine-এ packet loss-এর জন্য আলাদা WebRTC TURN server ও credentials configure করতে হয়। অনুমান করে 0% দেখানো হয় না।
- Public IP, ISP ও Location আলাদা `ipinfo.io` lookup service থেকে আসে। Lookup ব্যর্থ হলে “Unavailable” দেখাবে।
- Test চালালে measurement requests Cloudflare-এ যায়। Cloudflare-এর README অনুযায়ী test results তাদের aggregate Internet quality insights-এর জন্য সংগ্রহ করা হতে পারে: https://github.com/cloudflare/speedtest
- Test চলাকালে অন্য Download/Upload বন্ধ রাখলে তুলনামূলক পরিষ্কার ফল পাওয়া যায়।

## Troubleshooting

- `npm is not recognized`: Node.js Install করে Terminal/Command Prompt বন্ধ করে আবার খুলুন।
- Test-এ Error/CORS দেখালে Browser Extension, Ad Blocker বা VPN বন্ধ করে আবার চেষ্টা করুন। কিছু Network বা Browser Policy external measurement আটকাতে পারে।
- ISP/Network Lookup না এলে IP Lookup Service সাময়িকভাবে unavailable হতে পারে। Speed Test আলাদাভাবে কাজ করতে পারে।
- Browser Tab Active রাখুন। Background Tab Throttling Test-কে প্রভাবিত করতে পারে।

---

**Developed by Md. Jakirul Islam**
