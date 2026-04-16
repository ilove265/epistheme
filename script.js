document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Chuyển đổi giữa các Tab (Giữ nguyên)
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetSec = document.getElementById(targetId);
            if(targetSec) targetSec.classList.add('active');
        });
    });

    // 2. Lật Flashcard (Giữ nguyên)
    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
    }

    // 3. Cấu hình AI Assistant
    // LƯU Ý: Đảm bảo API Key của bạn còn hạn định mức (Quota)

    const MODEL_NAME = "gemini-2.5-flash";

    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    let chatHistory = [
        {
            role: "user",
            parts: [{ text: "Bạn là trợ lý AI STUDY cao cấp. Hãy hỗ trợ người dùng học tập, giải đáp kiến thức khoa học, vật lý, và soạn thảo đề thi chuyên nghiệp. Phong cách trả lời: Thông minh, súc tích, hơi hướng tương lai." }]
        },
        {
            role: "model",
            parts: [{ text: "Hệ thống AI STUDY đã sẵn sàng. Tôi có thể giúp gì cho tiến trình nghiên cứu của bạn?" }]
        }
    ];
    
    const assistantBox = document.querySelector('.ai-sidebar-assistant');
    const chatWindow = document.getElementById('ai-chat-window');
    const closeChat = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatContent = document.getElementById('chat-content');

    // Mở/Đóng Chat
    if(assistantBox) assistantBox.onclick = () => chatWindow.style.display = 'flex';
    if(closeChat) closeChat.onclick = () => chatWindow.style.display = 'none';

    // Hàm thêm tin nhắn vào giao diện
    function appendMessage(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${type}-msg`;
        msgDiv.innerText = text;
        chatContent.appendChild(msgDiv);
        chatContent.scrollTop = chatContent.scrollHeight; // Tự động cuộn xuống dưới
    }

    // Hàm gọi API Gemini
    async function callGemini(message) {
        chatHistory.push({ role: "user", parts: [{ text: message }] });

        try {
            const response = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: chatHistory })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error("Gemini API Error:", data.error.message);
                return `⚠️ Lỗi từ AI: ${data.error.message}`;
            }

            const reply = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: reply }] });
            return reply;
        } catch (error) {
            console.error("Network Error:", error);
            return "⚠️ Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra mạng.";
        }
    }

    // Hàm xử lý khi nhấn gửi
    async function handleChat() {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Hiển thị tin nhắn của người dùng
        appendMessage(text, 'user');
        userInput.value = '';

        // 2. Hiển thị hiệu ứng chờ
        const loading = document.createElement('div');
        loading.className = 'msg bot-msg loading-msg';
        loading.innerText = 'Đang suy nghĩ...';
        chatContent.appendChild(loading);
        chatContent.scrollTop = chatContent.scrollHeight;

        // 3. Gọi AI và hiển thị phản hồi
        const reply = await callGemini(text);
        
        // Xóa dòng "Đang suy nghĩ" và thêm câu trả lời thật
        if(chatContent.contains(loading)) chatContent.removeChild(loading);
        appendMessage(reply, 'bot');
    }

    // GÁN SỰ KIỆN (Chỉ gán 1 lần duy nhất)
    if (sendBtn) {
        sendBtn.onclick = handleChat;
    }

    if (userInput) {
        userInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                handleChat();
            }
        };
    }
});