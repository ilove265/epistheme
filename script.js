import { auth, db, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"; 
import { doc, setDoc, getDoc } from "firebase/firestore";
document.addEventListener('DOMContentLoaded', () => {
    // Lấy các phần tử giao diện
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.getElementById('user-profile');
    const userNameDisplay = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
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

    const MODEL_NAME = "gemini-3.1-flash-lite-preview";

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
        if (!currentUserData) {
            alert("Vui lòng đăng nhập để dùng AI!");
            return;
        }

        // Ví dụ cách gửi kèm tính cách:
        const systemPrompt = currentUserData.ai_personality;
        const finalInput = `[System Instruction: ${systemPrompt}] \n User: ${userInput}`;
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

    // 4. TÀI KHOẢN NGƯỜI DÙNG
    async function handleLogin() {
    console.log("Đang kích hoạt đăng nhập..."); // Dòng này để kiểm tra nút có ăn không
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Kiểm tra xem người dùng đã có thông tin trong Firestore chưa
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Nếu là người dùng mới, tạo mới thông tin và tính cách AI mặc định
                await setDoc(userDocRef, {
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    ai_personality: "Bạn là một trợ lý học tập thân thiện, luôn giải thích mọi thứ một cách dễ hiểu và cổ vũ người dùng.", // Tính cách mặc định
                    createdAt: new Date()
                });
                console.log("Đã tạo người dùng mới trên Firestore");
            }
        
        } catch (error) {
            console.error("Lỗi đăng nhập:", error);
            alert("Đăng nhập thất bại!");
        }
    }

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            location.reload(); // Load lại trang để xóa sạch dữ liệu cũ
        });
    });

    let currentUserData = null; // Biến toàn cục để lưu thông tin người dùng hiện tại

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP ---
            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
        
            // Hiển thị thông tin lên giao diện
            userNameDisplay.innerText = user.displayName;
            userAvatar.src = user.photoURL;

            // Lấy dữ liệu chi tiết (bao gồm tính cách AI) từ Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                console.log("Tính cách AI của bạn là:", currentUserData.ai_personality);
            }
        } else {
            // --- NGƯỜI DÙNG CHƯA ĐĂNG NHẬP ---
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            currentUserData = null;
        }
    });

    // Gán sự kiện cho nút bấm
    loginBtn.addEventListener('click', handleLogin);

});