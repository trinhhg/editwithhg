// v1.0 - Cloudflare Pages Advanced Worker - 2026-05-12
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Nếu là request lấy bộ từ điển cốt lõi
    if (url.pathname === '/data/core_dict.json') {
      const response = await env.ASSETS.fetch(request);
      
      // Tạo response mới để ép thêm Header Cache
      const newResponse = new Response(response.body, response);
      // Cache public trong 1 tiếng (3600s), không tốn băng thông đọc lại
      newResponse.headers.set('Cache-Control', 'public, max-age=3600');
      // Tránh lỗi CORS nếu bạn test code ở localhost (127.0.0.1)
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      
      return newResponse;
    }

    // Các request khác (HTML, CSS, JS tĩnh) trả về mặc định của Cloudflare Pages
    return env.ASSETS.fetch(request);
  }
};
