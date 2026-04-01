export default {
  async fetch(request, env) {
    // Handle CORS Pre-flight for s&box
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    const videoUrl = url.searchParams.get("url");

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    try {
      // 1. Extract Video ID
      const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      if (!videoId) throw new Error("Invalid YouTube URL");

      // 2. Fetch the page with a Mobile User Agent (Mobile links are easier to parse)
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&pbj=1`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        }
      });
      
      const html = await response.text();

      // 3. Robust Regex Extraction
      // This looks for the data even if YouTube moves it around the script tags
      const regex = /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+meta|<\/script|\n)/;
      const match = html.match(regex);

      if (!match) {
        throw new Error("Could not find video data on page. YouTube might be blocking this IP.");
      }

      const data = JSON.parse(match[1]);

      // 4. Filter for a playable MP4 stream
      // We prioritize 'url' presence because some formats are 'signatureCipher' (which we can't play natively)
      const formats = data.streamingData?.formats || [];
      const adaptiveFormats = data.streamingData?.adaptiveFormats || [];
      const allFormats = [...formats, ...adaptiveFormats];

      // Find the best single-file MP4 with both video and audio
      const bestFormat = allFormats.find(f => f.mimeType.includes('video/mp4') && f.url);

      if (!bestFormat) {
        throw new Error("No direct MP4 link available for this video (Protected Content).");
      }

      return new Response(JSON.stringify({
        title: data.videoDetails?.title || "Unknown Title",
        duration: parseInt(data.videoDetails?.lengthSeconds || "0"),
        direct_url: bestFormat.url,
        thumbnail: data.videoDetails?.thumbnail?.thumbnails?.pop()?.url || ""
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
