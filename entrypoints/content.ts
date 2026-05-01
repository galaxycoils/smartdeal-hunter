export default defineContentScript({
  matches: ['https://*.amazon.com/*'],
  runAt: 'document_idle',
  main() {
    // P1.4 implements ASIN detection + JSON-LD/DOM extraction. Bootstrap stub only.
    console.log('[smartdeal-hunter] content loaded on amazon page');
  },
});
