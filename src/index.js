export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get("url");

    if (!videoUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    try {
      // 1. Get Video ID
      const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      
      // 2. Fetch YouTube Watch Page
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      const html = await response.text();

      // 3. Extract the 'streamingData' JSON
      const jsonStr = html.split('ytInitialPlayerResponse = ')[1]?.split(';</script>')[0];
      const data = JSON.parse(jsonStr);

      // 4. Find the best MP4 format (MPEG-4)
      const format = data.streamingData.formats.find(f => f.mimeType.includes('video/mp4')) || data.streamingData.formats[0];

      return new Response(JSON.stringify({
        title: data.videoDetails.title,
        direct_url: format.url,
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" // Allows s&box to call this
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
