import React, { useState, useEffect, useRef } from 'react';

// 🌐 จุดเชื่อมต่อ Firebase Config ในอนาคต
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  databaseURL: "YOUR_DATABASE_URL_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

const escrowChannel = new BroadcastChannel('escrow_simulation_channel');

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('korawin@gmail.com');
  const [userProfile, setUserProfile] = useState({
    username: 'Korawin_Player',
    email: 'korawin@gmail.com',
    uid: 'EG-95421'
  });

  // 🚫 รายชื่อ UID ที่โดนแบน (ระบบจำลอง)
  const [bannedUids, setBannedUids] = useState(['EG-66666', 'EG-00000']);

  // 📊 ฐานข้อมูลเก็บบันทึกประวัติสถิติการซื้อขายของแต่ละ UID
  const [userStatsDatabase, setUserStatsDatabase] = useState({
    'EG-95421': { success: 5, canceled: 1 }, 
    'EG-88741': { success: 12, canceled: 2 } 
  });

  const [targetUid, setTargetUid] = useState('');
  const [dealPrice, setDealPrice] = useState('');
  const [gameName, setGameName] = useState('RoV');
  const [myRole, setMyRole] = useState('คนซื้อ'); 
  const [paymentMethod, setPaymentMethod] = useState('bank');

  const [trades, setTrades] = useState([
    { id: 'TX-001', game: 'RoV', role: 'คนกลาง', price: 150, fee: 5, finalPaid: 145, status: 'สำเร็จ', date: '19 พ.ค. 2026', buyerUid: 'EG-95421', sellerUid: 'EG-88741' },
  ]);

  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [dealStatusStep, setDealStatusStep] = useState(1); 
  
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [selectedSlipFile, setSelectedSlipFile] = useState(null);
  const [slipErrorMessage, setSlipErrorMessage] = useState('');

  // ⏱️ ระบบจับเวลา 15 นาที (900 วินาที)
  const [timeLeft, setTimeLeft] = useState(900);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef(null);

  // 🏦 ข้อมูลบัญชีคนขาย
  const [sellerPayoutInfo, setSellerPayoutInfo] = useState({
    payoutType: 'ธนาคารกสิกรไทย', 
    accountNo: '',
    accountName: ''
  });
  const [isPayoutSaved, setIsPayoutSaved] = useState(false);

  // 📋 คิวงานโอนเงินสดสำหรับแอดมินกดมือ 
  const [adminPayoutQueue, setAdminPayoutQueue] = useState([
    { id: 'PQ-101', tradeId: 'TX-001', payoutType: 'ธนาคารกสิกรไทย', accountNo: '0987654321', accountName: 'นาย สมชาย สายซิ่ง', amount: 145, status: 'โอนสำเร็จแล้ว' }
  ]);

  // 📝 ข้อมูลฟีดแบ็ค
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackList, setFeedbackList] = useState([
    { id: 1, user: 'User_Test1', text: 'อยากให้เพิ่มระบบแจ้งเตือนผ่าน LINE เวลาเงินเข้าครับ', date: '19 พ.ค. 2026' }
  ]);

  // 🛡️ ข้อมูลแผงควบคุมแอดมิน
  const [searchUidInput, setSearchUidInput] = useState('');
  const [adminInvestigationResult, setAdminInvestigationResult] = useState(null);

  // 📱 ตัวแปรสำหรับจำลองหน้าจอมือถือแอดมินเวลา LINE เด้งในระบบทดสอบ
  const [simulatedLineNotification, setSimulatedLineNotification] = useState(null);

  const fixedFee = 5;
  const sellerReceives = dealPrice ? Math.max(0, Number(dealPrice) - fixedFee) : 0;

  // ⏱️ ลอจิกนับเวลาถอยหลัง
  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
      const sysMsg = {
        sender: '🚨 ระบบแจ้งเตือนเวลา',
        text: `⚠️ หมดเวลาส่งมอบรหัส 15 นาทีแล้ว! คนขายยังไม่มีการส่งมอบรหัสที่ถูกต้อง ฝั่งคนซื้อได้รับสิทธิ์กดยกเลิกดีลและขอเงินคืน (Refund) ได้ทันทีคราฟ`,
        time: 'เมื่อครู่',
        isSystem: true
      };
      setChatMessages(prev => [...prev, sysMsg]);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, isTimerActive]);

  useEffect(() => {
    const handleMessageFromOtherWindow = (event) => {
      const { type, data } = event.data;

      if (type === 'NEW_CHAT_ROOM') {
        setActiveChat(data.trade);
        setDealStatusStep(1);
        setChatMessages(data.messages);
        setIsVerifyingSlip(false);
        setSelectedSlipFile(null);
        setSlipErrorMessage('');
        setIsPayoutSaved(false); 
        setIsTimerActive(false);
        setTimeLeft(900);
        setSimulatedLineNotification(null);
      } else if (type === 'SEND_MESSAGE') {
        setChatMessages((prev) => [...prev, data]);
      } else if (type === 'UPDATE_STATUS') {
        setDealStatusStep(data.step);
        if (data.messages) setChatMessages(data.messages);
        if (data.isTimerActive !== undefined) setIsTimerActive(data.isTimerActive);
        if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
        if (data.tradeId && data.status) {
          setTrades(prev => prev.map(t => t.id === data.tradeId ? { ...t, status: data.status } : t));
        }
        if (data.sellerPayoutInfo) {
          setSellerPayoutInfo(data.sellerPayoutInfo);
          setIsPayoutSaved(data.isPayoutSaved !== undefined ? data.isPayoutSaved : true);
        }
        if (data.updatedStatsDb) {
          setUserStatsDatabase(data.updatedStatsDb);
        }
        if (data.updatedPayoutQueue) {
          setAdminPayoutQueue(data.updatedPayoutQueue);
        }
        if (data.lineNotifySim) {
          setSimulatedLineNotification(data.lineNotifySim);
        }
      } else if (type === 'SUBMIT_SELLER_PAYOUT') {
        setSellerPayoutInfo(data.payoutInfo);
        setIsPayoutSaved(data.isPayoutSaved);
        setChatMessages((prev) => [...prev, data.systemMessage]);
      } else if (type === 'SEND_FEEDBACK') {
        setFeedbackList((prev) => [data, ...prev]);
      } else if (type === 'BAN_USER_SYNC') {
        setBannedUids(prev => [...prev, data.uid]);
      }
    };

    escrowChannel.addEventListener('message', handleMessageFromOtherWindow);
    return () => escrowChannel.removeEventListener('message', handleMessageFromOtherWindow);
  }, []);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (bannedUids.includes(userProfile.uid)) {
      alert(`❌ บัญชีของคุณถูกระงับการใช้งาน! UID: ${userProfile.uid} ถูกแบนถาวรเนื่องจากตรวจพบการทุจริต/ฉ้อโกง`);
      return;
    }
    setIsLoggedIn(true); 
  };

  const handleRoleSelect = (role) => {
    setMyRole(role);
    if (role === 'คนขาย') {
      setUserProfile({ username: 'Bird_Seller', email: 'bird@gmail.com', uid: 'EG-88741' });
    } else {
      setUserProfile({ username: 'Korawin_Player', email: 'korawin@gmail.com', uid: 'EG-95421' });
    }
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!targetUid) return;

    if (bannedUids.includes(targetUid)) {
      alert(`⚠️ ไม่สามารถเปิดดีลได้: เนื่องจาก UID ปลายทาง (${targetUid}) ติดรายชื่อผู้ใช้งานที่ทุจริตและถูกแบนออกจากระบบแล้ว!`);
      return;
    }

    const newId = `TX-0${trades.length + 1}`;
    const priceNum = Number(dealPrice);
    
    const newTrade = {
      id: newId,
      role: myRole,
      game: gameName,
      price: priceNum,
      fee: fixedFee,
      finalPaid: priceNum - fixedFee,
      status: 'รอดำเนินการ',
      date: '19 พ.ค. 2026',
      buyerUid: myRole === 'คนซื้อ' ? userProfile.uid : targetUid,
      sellerUid: myRole === 'คนขาย' ? userProfile.uid : targetUid
    };

    setTrades([newTrade, ...trades]);
    setActiveChat(newTrade);
    setDealStatusStep(1);
    setIsPayoutSaved(false);
    setSelectedSlipFile(null);
    setSlipErrorMessage('');
    setIsTimerActive(false);
    setTimeLeft(900);
    setSimulatedLineNotification(null);

    const buyerStats = userStatsDatabase[newTrade.buyerUid] || { success: 0, canceled: 0 };
    const sellerStats = userStatsDatabase[newTrade.sellerUid] || { success: 0, canceled: 0 };

    const initialMessages = [
      { sender: '🤖 ระบบอัตโนมัติ', text: `📢 ห้องซื้อขายกลางสร้างสำเร็จ! [เกม: ${gameName}] [ราคาสินค้า: ${priceNum.toLocaleString()} บาท]`, time: 'ตอนนี้', isSystem: true },
      { sender: '🤖 ระบบอัตโนมัติ', text: `🆔 [ผู้ใช้ในห้อง]: คนซื้อ UID (${newTrade.buyerUid}) | คนขาย UID (${newTrade.sellerUid})`, time: 'ตอนนี้', isSystem: true },
      { sender: '📊 บันทึกประวัติเครดิต UID', text: `🛒 คนซื้อ UID: ${newTrade.buyerUid} [ซื้อขายสำเร็จ: ${buyerStats.success} ครั้ง | ยกเลิกดีล: ${buyerStats.canceled} ครั้ง] \n💰 คนขาย UID: ${newTrade.sellerUid} [ซื้อขายสำเร็จ: ${sellerStats.success} ครั้ง | ยกเลิกดีล: ${sellerStats.canceled} ครั้ง]`, time: 'ตอนนี้', isSystem: true },
      { sender: '🤖 ระบบอัตโนมัติ', text: `💰 คนขายจะได้รับเงินสุทธิ ${ (priceNum - fixedFee).toLocaleString() } บาท (หักค่ากลางออก 5 บาท)`, time: 'ตอนนี้', isSystem: true },
      { sender: 'ℹ️ ชี้แจงระบบโอนเงินสด', text: `⚡ [โปรดทราบ]: เมื่อซื้อขายสำเร็จ ระบบจะยิงข้อมูลบัญชีคนขายเข้า LINE แอดมินทันที เพื่อให้แอดมินโอนเงินสดให้อย่างรวดเร็วที่สุด คนขายรอรับเงินได้เลยคราฟ`, time: 'ตอนนี้', isSystem: true },
      { sender: '🤖 ระบบอัตโนมัติ', text: `⚠️ [ฝั่งคนขาย] โปรดกรอกข้อมูลบัญชีรับเงินที่เมนูด้านขวามือให้ถูกต้องด้วยคราฟ`, time: 'ตอนนี้', isSystem: true }
    ];
    setChatMessages(initialMessages);

    escrowChannel.postMessage({
      type: 'NEW_CHAT_ROOM',
      data: {
        trade: { ...newTrade, role: myRole === 'คนซื้อ' ? 'คนขาย' : 'คนซื้อ' },
        messages: initialMessages
      }
    });

    setTargetUid('');
    setDealPrice('');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg = {
      sender: userProfile.username,
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, newMsg]);
    escrowChannel.postMessage({ type: 'SEND_MESSAGE', data: newMsg });
    setInputMessage('');
  };

  const handleSavePayoutInfo = (e) => {
    e.preventDefault();
    if (!sellerPayoutInfo.accountNo || !sellerPayoutInfo.accountName) {
      alert('กรุณากรอกเลขบัญชีและชื่อบัญชีให้ครบถ้วนคราฟ');
      return;
    }

    const doubleCheck = window.confirm("🚨 โปรดเช็กเบอร์และชื่อให้ถูกต้องอีกครั้งก่อนกดยืนยัน!");
    if (!doubleCheck) return; 

    setIsPayoutSaved(true);
    
    const sysMsg = {
      sender: '🤖 ระบบอัตโนมัติ',
      text: `🔒 [คนขายบันทึกบัญชีแล้ว] ล็อกข้อมูลช่องทางรับเงิน: [${sellerPayoutInfo.payoutType}] เลขบัญชี/เบอร์ [${sellerPayoutInfo.accountNo}] ชื่อ [${sellerPayoutInfo.accountName}]`,
      time: 'เมื่อครู่',
      isSystem: true
    };

    setChatMessages((prev) => [...prev, sysMsg]);
    escrowChannel.postMessage({
      type: 'SUBMIT_SELLER_PAYOUT',
      data: { payoutInfo: sellerPayoutInfo, isPayoutSaved: true, systemMessage: sysMsg }
    });
  };

  const handleUnlockPayoutInfo = () => {
    setIsPayoutSaved(false);

    const sysMsg = {
      sender: '⚠️ ระบบรักษาความปลอดภัย',
      text: `🚨 [คำเตือน] คนขายได้ทำการกด "ปลดล็อกแก้ไขบัญชีรับเงิน" โปรดตรวจสอบความถูกต้องของเลขบัญชีใหม่อีกครั้งก่อนแอดมินโอนเงิน!`,
      time: 'เมื่อครู่',
      isSystem: true
    };

    setChatMessages((prev) => [...prev, sysMsg]);
    escrowChannel.postMessage({
      type: 'SUBMIT_SELLER_PAYOUT',
      data: { payoutInfo: sellerPayoutInfo, isPayoutSaved: false, systemMessage: sysMsg }
    });
  };

  const handleSendFeedback = (e) => {
    e.preventDefault();
    if (!feedbackInput.trim()) return;

    const newFeedback = {
      id: feedbackList.length + 1,
      user: userProfile.username,
      text: feedbackInput,
      date: '19 พ.ค. 2026'
    };

    setFeedbackList([newFeedback, ...feedbackList]);
    escrowChannel.postMessage({ type: 'SEND_FEEDBACK', data: newFeedback });
    
    alert('📧 ส่งความคิดเห็นสำเร็จแล้วคราฟ! ขอบคุณที่ช่วยเราปรับปรุงระบบให้ดีขึ้น');
    setFeedbackInput('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSlipErrorMessage('');
    if (!file) return;
    if (!file.type.match('image.*')) {
      setSlipErrorMessage('⚠️ กรุณาเลือกไฟล์ที่เป็นรูปภาพสลิปเท่านั้นคราฟ!');
      setSelectedSlipFile(null);
      return;
    }
    setSelectedSlipFile(file);
  };

  const handleRealSlipVerification = async (e) => {
    e.preventDefault();
    if (!selectedSlipFile) {
      alert('กรุณาเลือกไฟล์รูปสลิปก่อนกดปุ่มคราฟ');
      return;
    }

    setIsVerifyingSlip(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const nextStep = 2;
      const updateMsgs = [
        ...chatMessages,
        { sender: '📸 ระบบตรวจสลิปออโต้', text: `✅ [สแกนสำเร็จ!] ตรวจพบยอดโอนเข้าบัญชี นายกรวินท์ เรียบร้อย ระบบอนุมัติผ่าน ยอดเงินเข้าบัญชีกลางแล้วคราฟ`, time: 'เมื่อครู่', isSystem: true },
        { sender: '🤖 ระบบอัตโนมัติ', text: `🔓 Status: ปลอดภัยแล้ว! ⏳ [ระบบสับเวลาถอยหลังจับเวลา 15 นาทีเริ่มแล้ว] 📌 ฝั่งคนขายรีบส่งมอบรหัสเกมในช่องแชทนี้เลยครับ`, time: 'เมื่อครู่', isSystem: true }
      ];

      setDealStatusStep(nextStep);
      setChatMessages(updateMsgs);
      setIsTimerActive(true); 

      escrowChannel.postMessage({
        type: 'UPDATE_STATUS',
        data: { step: nextStep, messages: updateMsgs, sellerPayoutInfo, isTimerActive: true, timeLeft: 900 }
      });

    } catch (error) {
      setSlipErrorMessage('❌ เกิดข้อผิดพลาดในการตรวจสอบสลิป โปรดลองใหม่อีกครั้ง');
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const handleConfirmReleaseMoney = () => {
    if (!isPayoutSaved) {
      alert('⚠️ ไม่สามารถปล่อยเงินได้: เนื่องจากคนขายยังกรอกข้อมูลบัญชีไม่เสร็จ หรือกำลังกดแก้ไขข้อมูลอยู่คราฟ!');
      return;
    }

    const doubleCheck = window.confirm("⚠️ ยืนยันปล่อยเงินให้คนขาย? ระบบจะบันทึกส่งข้อมูลไปที่ LINE ของแอดมินทันทีเพื่อให้โอนเงินสด");
    if (!doubleCheck) return;

    const nextStep = 3;

    const nextStatsDb = { ...userStatsDatabase };
    if (nextStatsDb[activeChat.buyerUid]) nextStatsDb[activeChat.buyerUid].success += 1;
    if (nextStatsDb[activeChat.sellerUid]) nextStatsDb[activeChat.sellerUid].success += 1;
    setUserStatsDatabase(nextStatsDb);

    const newQueueItem = {
      id: `PQ-${100 + adminPayoutQueue.length + 1}`,
      tradeId: activeChat.id,
      payoutType: sellerPayoutInfo.payoutType,
      accountNo: sellerPayoutInfo.accountNo,
      accountName: sellerPayoutInfo.accountName,
      amount: activeChat.finalPaid,
      status: '⏳ รอแอดมินกดโอนเงินสด'
    };
    const updatedQueue = [newQueueItem, ...adminPayoutQueue];
    setAdminPayoutQueue(updatedQueue);

    // 📱 [ระบบจำลอง LINE Notify ส่งเข้ามือน้ากรวินท์]
    const lineNotifyData = {
      tradeId: activeChat.id,
      game: activeChat.game,
      amount: activeChat.finalPaid,
      bankType: sellerPayoutInfo.payoutType,
      accountNo: sellerPayoutInfo.accountNo,
      accountName: sellerPayoutInfo.accountName
    };
    setSimulatedLineNotification(lineNotifyData);

    const updateMsgs = [
      ...chatMessages,
      { sender: '🎉 ระบบบันทึกประวัติสำเร็จ', text: `📈 อัปเดตสถิติสำเร็จ! บัญชี UID ทั้งคู่ถูกบันทึกประวัติการดีลสำเร็จสะสมเพิ่มขึ้น +1 ครั้งคราฟ`, time: 'เมื่อครู่', isSystem: true },
      { sender: '🤖 ระบบอัตโนมัติ', text: `🎉 คนซื้อยืนยันตรวจสอบรหัสเรียบร้อย! ระบบทำการส่งข้อมูลบัญชีรับเงินของคุณเข้า LINE ของแอดมินโดยตรงเรียบร้อยแล้วคราฟ ทางแอดมินจะรีบทำการตรวจสอบและกดโอนเงินสดเข้าบัญชีให้ท่านทันที โปรดรอสักครู่นะครับคราฟ คนขายสบายใจได้เลย!`, time: 'เมื่อครู่', isSystem: true },
      { sender: '📱 ระบบแจ้งเตือนแอดมิน', text: `🚀 [LINE Notify ส่งออกสำเร็จ] ยิงข้อมูลใบสั่งโอนเงินยอด ${activeChat.finalPaid.toLocaleString()} บาท ไปที่ไลน์แอดมินเรียบร้อยแล้วคราฟ`, time: 'เมื่อครู่', isSystem: true }
    ];

    setDealStatusStep(nextStep);
    setChatMessages(updateMsgs);
    setIsTimerActive(false); 
    setTrades(prev => prev.map(t => t.id === activeChat.id ? { ...t, status: 'รอดำเนินการโอนเงิน' } : t));

    escrowChannel.postMessage({
      type: 'UPDATE_STATUS',
      data: { 
        step: nextStep, 
        messages: updateMsgs, 
        tradeId: activeChat.id, 
        status: 'รอดำเนินการโอนเงิน', 
        sellerPayoutInfo, 
        isTimerActive: false, 
        updatedStatsDb: nextStatsDb,
        updatedPayoutQueue: updatedQueue,
        lineNotifySim: lineNotifyData
      }
    });
  };

  const handleRefundBuyer = () => {
    const doubleCheck = window.confirm("🚨 ยืนยันทำรายการคืนเงิน (Refund) ให้คนซื้อเต็มจำนวนเนื่องจากคนขายหมดเวลาส่งงานหรือไม่?");
    if (!doubleCheck) return;

    const nextStep = 3;

    const nextStatsDb = { ...userStatsDatabase };
    if (nextStatsDb[activeChat.buyerUid]) nextStatsDb[activeChat.buyerUid].canceled += 1;
    if (nextStatsDb[activeChat.sellerUid]) nextStatsDb[activeChat.sellerUid].canceled += 1;
    setUserStatsDatabase(nextStatsDb);

    const updateMsgs = [
      ...chatMessages,
      { sender: '❌ ระบบบันทึกประวัติยกเลิก', text: `⚠️ อัปเดตสถิติยกเลิก! บัญชี UID ทั้งคู่ถูกบันทึกประวัติการยกเลิกดีลสะสมเพิ่มขึ้น +1 ครั้งคราฟ`, time: 'เมื่อครู่', isSystem: true },
      { sender: '🛡️ แอดมินระบบ', text: `❌ ดีลนี้ถูกยกเลิกเนื่องจากเกินกำหนดเวลา 15 นาที แอดมินทำการสั่งดึงเงินคืนเข้าบัญชีคนซื้อเรียบร้อยคราฟ`, time: 'เมื่อครู่', isSystem: true }
    ];
    setDealStatusStep(nextStep);
    setChatMessages(updateMsgs);
    setIsTimerActive(false);
    setTrades(prev => prev.map(t => t.id === activeChat.id ? { ...t, status: 'ยกเลิก/คืนเงิน' } : t));

    escrowChannel.postMessage({
      type: 'UPDATE_STATUS',
      data: { step: nextStep, messages: updateMsgs, tradeId: activeChat.id, status: 'ยกเลิก/คืนเงิน', isTimerActive: false, updatedStatsDb: nextStatsDb }
    });
  };

  const handleConfirmPayoutDone = (queueId, tradeId) => {
    const doubleCheck = window.confirm(`💵 ยืนยันว่าคุณกดแอปธนาคารโอนเงินสดเสร็จสิ้นแล้วสำหรับคิวงาน ${queueId}?`);
    if (!doubleCheck) return;

    const updatedQueue = adminPayoutQueue.map(q => q.id === queueId ? { ...q, status: '✅ โอนสำเร็จแล้ว' } : q);
    setAdminPayoutQueue(updatedQueue);
    setSimulatedLineNotification(null); // เคลียร์แจ้งเตือนในไลน์เมื่อโอนเสร็จ

    const updateMsgs = [
      ...chatMessages,
      { sender: '🤖 ระบบอัตโนมัติ', text: `✅ แอดมินตรวจสอบความถูกต้องและกดโอนเงินสดเข้าบัญชีคนขายเรียบร้อยแล้วคราฟ! สถานะออเดอร์ปิดงานสมบูรณ์ 100%`, time: 'เมื่อครู่', isSystem: true }
    ];
    
    if (activeChat && activeChat.id === tradeId) {
      setChatMessages(updateMsgs);
    }
    
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, status: 'สำเร็จ' } : t));
    
    escrowChannel.postMessage({ 
      type: 'UPDATE_STATUS', 
      data: { 
        step: 3, 
        messages: updateMsgs, 
        tradeId: tradeId, 
        status: 'สำเร็จ',
        updatedPayoutQueue: updatedQueue,
        lineNotifySim: null
      } 
    });
  };

  const handleSummonAdmin = () => {
    const updateMsgs = [
      ...chatMessages,
      { sender: '🛡️ แอดมิน (คุณ)', text: `⚠️ [แอดมินเข้าร่วมกลุ่ม] สวัสดีครับ แอดมินเข้ามาร่วมตรวจสอบข้อพิพาท มีปัญหาอะไรทิ้งรายละเอียดไว้ได้เลยครับ`, time: 'เมื่อครู่', isSystem: true }
    ];
    setChatMessages(updateMsgs);
    escrowChannel.postMessage({ type: 'UPDATE_STATUS', data: { step: dealStatusStep, messages: updateMsgs } });
  };

  const handleAdminInvestigate = (e) => {
    e.preventDefault();
    if (!searchUidInput.trim()) return;

    const foundTrade = trades.find(t => t.buyerUid === searchUidInput || t.sellerUid === searchUidInput || t.id === searchUidInput);
    
    if (foundTrade) {
      setAdminInvestigationResult({
        trade: foundTrade,
        logs: chatMessages 
      });
    } else {
      alert(`❌ ไม่พบข้อมูลห้องแชทหรือประวัติซื้อขายที่เกี่ยวข้องกับ UID / เลขดีล "${searchUidInput}" นี้ในระบบคราฟ`);
      setAdminInvestigationResult(null);
    }
  };

  const handleAdminBanUser = (uidToBan) => {
    if (!uidToBan) return;
    const confirmBan = window.confirm(`🚫 คุณแน่ใจใช่ไหมที่จะทำรายการ "แบนถาวร" บัญชี UID: ${uidToBan}? ผู้ใช้คนนี้จะไม่สามารถทำธุรกรรมได้อีกต่อไป`);
    if (!confirmBan) return;

    setBannedUids(prev => [...prev, uidToBan]);
    escrowChannel.postMessage({ type: 'BAN_USER_SYNC', data: { uid: uidToBan } });
    alert(`🚨 สั่งแบนบัญชี UID: ${uidToBan} เรียบร้อย! ตัดขาดสิทธิ์เข้าใช้งานระบบทันทีคราฟ`);
    
    if (activeChat && (activeChat.buyerUid === uidToBan || activeChat.sellerUid === uidToBan)) {
      setChatMessages(prev => [
        ...prev,
        { sender: '🚫 ระบบรักษาความปลอดภัย', text: `🚨 [ประกาศระบบ] บัญชีผู้ใช้ UID (${uidToBan}) ถูกแบนออกจากแพลตฟอร์มเนื่องจากตรวจพบพฤติกรรมฉ้อโกง! ดีลนี้ถูกระงับชั่วคราว`, time: 'เมื่อครู่', isSystem: true }
      ]);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isLoggedIn) {
    return (
      <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ffffff', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '32px', borderRadius: '16px', border: '1px solid #334155', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#3b82f6', textAlign: 'center', marginBottom: '24px' }}>ESCROW AUTO-BANK SYSTEM</h1>
          {bannedUids.includes(userProfile.uid) && (
            <div style={{ backgroundColor: '#ef444420', border: '1px solid #ef4444', padding: '12px', borderRadius: '10px', color: '#f87171', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 'bold' }}>
              🚨 บัญชีปัจจุบันของคุณถูกแบนจากแผงแอดมินแล้วคราฟ
            </div>
          )}
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="email" placeholder="อีเมล" value={userProfile.email} onChange={(e) => setUserProfile({...userProfile, email: e.target.value})} style={{ padding: '12px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} required />
            <input type="password" placeholder="รหัสผ่าน" defaultValue="123456" style={{ padding: '12px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} required />
            <button type="submit" style={{ padding: '12px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>เข้าสู่ระบบทดสอบ</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#ffffff', fontFamily: 'sans-serif', padding: '24px' }}>
      
      {/* 🟢 หน้าจอมือถือแอดมินจำลองเมื่อ LINE เด้งเตือน (เพิ่มเข้ามาใหม่เพื่อให้น้าเห็นภาพชัดเจน) */}
      {simulatedLineNotification && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', width: '350px', backgroundColor: '#06c755', color: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', zIndex: 9999, border: '2px solid #fff', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #05b04b', paddingBottom: '6px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>💬 LINE Notify (โทรศัพท์แอดมิน)</span>
            <button onClick={() => setSimulatedLineNotification(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
          <div style={{ backgroundColor: '#ffffff', color: '#000000', padding: '12px', borderRadius: '8px', fontSize: '12px', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#ef4444' }}>🚨 มีดีลสำเร็จใหม่!</p>
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />
            <div><strong>🆔 รหัสดีล:</strong> {simulatedLineNotification.tradeId} (เกม: {simulatedLineNotification.game})</div>
            <div><strong>💰 ยอดโอนสุทธิ:</strong> <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '13px'}}>{simulatedLineNotification.amount.toLocaleString()} บาท</span></div>
            <div><strong>🏦 ธนาคาร:</strong> {simulatedLineNotification.bankType}</div>
            <div style={{ marginTop: '4px', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cbd5e1' }}>
              <span>💳 <strong>เลขบัญชี:</strong> <code style={{fontSize: '13px', color: '#2563eb', fontWeight: 'bold'}}>{simulatedLineNotification.accountNo}</code></span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(simulatedLineNotification.accountNo);
                  alert(`📋 คัดลอกเลขบัญชี ${simulatedLineNotification.accountNo} สำหรับเอาไปวางในแอปธนาคารแล้วคราฟ!`);
                }}
                style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
              >
                คัดลอกเลข
              </button>
            </div>
            <div style={{ marginTop: '4px' }}><strong>👤 ชื่อบัญชี:</strong> {simulatedLineNotification.accountName}</div>
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '6px 0' }} />
            <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', textAlign: 'center' }}>📌 กดยืนยันการโอนเงินได้ที่ระบบด้านล่างได้ทันทีคราฟ</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '16px 24px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #334155' }}>
        <div>
          <h2 style={{ margin: '0', fontSize: '18px', color: '#3b82f6', fontWeight: '800' }}>ระบบคนกลางอัจฉริยะ (หักค่ากลาง 5 บาท + บัญชีกลางอัตโนมัติ)</h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>คุณกำลังดูหน้าจอ: <strong style={{color: '#fff'}}>{userProfile.username}</strong> ({myRole}) | UID: <span style={{color: '#60a5fa', fontWeight: 'bold'}}>{userProfile.uid}</span></p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px' }}>➕ สร้างกลุ่มซื้อขายใหม่</h3>
          <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>1. เลือกบทบาทหน้าจอนี้ก่อนทดสอบ</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => handleRoleSelect('คนซื้อ')} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', border: myRole === 'คนซื้อ' ? '2px solid #3b82f6' : '1px solid #334155', backgroundColor: myRole === 'คนซื้อ' ? '#3b82f620' : '#020617', color: myRole === 'คนซื้อ' ? '#3b82f6' : '#94a3b8' }}>🛒 คนซื้อ</button>
                <button type="button" onClick={() => handleRoleSelect('คนขาย')} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', border: myRole === 'คนขาย' ? '2px solid #f59e0b' : '1px solid #334155', backgroundColor: myRole === 'คนขาย' ? '#f59e0b20' : '#020617', color: myRole === 'คนขาย' ? '#f59e0b' : '#94a3b8' }}>💰 คนขาย</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>ระบุเกม</label>
                <select value={gameName} onChange={(e) => setGameName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '10px', color: '#fff' }}>
                  <option value="RoV">RoV</option>
                  <option value="Free Fire">Free Fire</option>
                  <option value="Roblox">Roblox</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>ใส่ UID อีกฝ่าย</label>
                <input type="text" placeholder="เช่น EG-88741" value={targetUid} onChange={(e) => setTargetUid(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '10px', color: '#fff' }} required />
              </div>
            </div>
            
            <div style={{ backgroundColor: '#020617', padding: '14px', borderRadius: '12px', border: '1px solid #334155' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#60a5fa', marginBottom: '6px' }}>💰 ระบุราคาสินค้าที่ตกลงกัน (บาท)</label>
              <input type="number" placeholder="เช่น 50" value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: 'bold' }} required />
              
              {dealPrice && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💵 ราคาสินค้า:</span> <span style={{color: '#fff'}}>{Number(dealPrice).toLocaleString()} บาท</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}><span>⚡ ค่ากลางแพลตฟอร์ม:</span> <span>+ 5 บาท</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 'bold', fontSize: '13px', marginTop: '4px', borderTop: '1px dashed #334155', paddingTop: '4px' }}>
                    <span>💰 คนขายจะได้รับเงินสุทธิ:</span>
                    <span>{sellerReceives.toLocaleString()} บาท</span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>เปิดห้องแชทดีลกลางทันที</button>
          </form>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px' }}>📜 ประวัติการดูแลดีลในระบบ</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '12px' }}>
                <th style={{ padding: '8px' }}>รหัสดีล</th>
                <th style={{ padding: '8px' }}>เกม</th>
                <th style={{ padding: '8px' }}>คนซื้อ/คนขาย</th>
                <th style={{ padding: '8px' }}>ยอดสุทธิ</th>
                <th style={{ padding: '8px' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} style={{ borderBottom: '1px solid #334155', fontSize: '12px' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold', color: '#60a5fa' }}>{trade.id}</td>
                  <td style={{ padding: '8px' }}>{trade.game}</td>
                  <td style={{ padding: '8px', color: '#cbd5e1' }}>{trade.buyerUid} ➡️ {trade.sellerUid}</td>
                  <td style={{ padding: '8px', color: '#10b981', fontWeight: 'bold' }}>{trade.finalPaid} บ.</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ backgroundColor: trade.status === 'สำเร็จ' ? '#10b98120' : '#f59e0b20', color: trade.status === 'สำเร็จ' ? '#10b981' : '#f59e0b', padding: '2px 6px', borderRadius: '4px' }}>{trade.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeChat && (
        <div style={{ marginTop: '24px', backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #2563eb' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#020617', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#60a5fa' }}>📍 ความคืบหน้าของเงินในบัญชี (ดีล {activeChat.id}):</span>
            
            {isTimerActive && (
              <div style={{ backgroundColor: '#ef444420', border: '1px solid #ef4444', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⏱️ โปรดทำการเช็กรหัสพร้อมถ่ายคลิปก่อนเข้ารหัสภายใน 15 นาที: <span style={{ fontSize: '15px', color: '#fff', fontFamily: 'monospace' }}>{formatTime(timeLeft)}</span> นาที
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <span style={{ color: dealStatusStep === 1 ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>
                {dealStatusStep > 1 ? '✅ 1. ตรวจสลิปผ่านแล้ว' : '⏳ 1. รอคนซื้ออัปโหลดสลิป'}
              </span>
              <span style={{ color: dealStatusStep === 2 ? '#f59e0b' : (dealStatusStep > 2 ? '#10b981' : '#475569'), fontWeight: 'bold' }}>
                {dealStatusStep === 2 ? '⏳ 2. คนขายกำลังส่งรหัส' : (dealStatusStep > 2 ? '✅ 2. ส่งรหัสแล้ว' : '⏳ 2. รอคนขายส่งรหัส')}
              </span>
              <span style={{ color: dealStatusStep === 3 ? '#10b981' : '#475569', fontWeight: 'bold' }}>🎉 3. โอนสำเร็จรอแอดมิน</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>💬 ช่องแชทกลาง (ระบบ Auto แจ้งเตือนเงินเข้าบัญชีอัตโนมัติ)</h4>
              <div style={{ backgroundColor: '#020617', height: '240px', borderRadius: '12px', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #334155' }}>
                {chatMessages.map((msg, index) => (
                  <div key={index} style={{ alignSelf: msg.isSystem ? 'center' : (msg.sender === userProfile.username ? 'flex-end' : 'flex-start'), maxWidth: '85%' }}>
                    <span style={{ fontSize: '11px', color: msg.isSystem ? (msg.sender.includes('ใบสั่งโอน') || msg.sender.includes('แจ้งเตือนแอดมิน') ? '#10b981' : (msg.sender.includes('คำเตือน') || msg.sender.includes('ความปลอดภัย') ? '#ef4444' : (msg.sender.includes('ระบบโอน') || msg.sender.includes('ชี้แจง') ? '#60a5fa' : '#f87171'))) : (msg.sender === userProfile.username ? '#60a5fa' : '#f59e0b'), display: 'block', textAlign: msg.isSystem ? 'center' : (msg.sender === userProfile.username ? 'right' : 'left') }}>
                      {msg.sender} ({msg.time})
                    </span>
                    <div style={{ backgroundColor: msg.isSystem ? (msg.sender.includes('ใบสั่งโอน') || msg.sender.includes('แจ้งเตือนแอดมิน') ? '#10b98115' : (msg.sender.includes('คำเตือน') || msg.sender.includes('ความปลอดภัย') ? '#ef444415' : (msg.sender.includes('ระบบโอน') || msg.sender.includes('ชี้แจง') ? '#2563eb10' : '#33415530'))) : (msg.sender === userProfile.username ? '#2563eb' : '#1e293b'), padding: '8px 12px', borderRadius: '12px', fontSize: '13px', marginTop: '2px', border: msg.isSystem ? (msg.sender.includes('ใบสั่งโอน') || msg.sender.includes('แจ้งเตือนแอดมิน') ? '1px solid #10b981' : (msg.sender.includes('คำเตือน') || msg.sender.includes('ความปลอดภัย') ? '1px solid #ef4444' : (msg.sender.includes('ระบบโอน') || msg.sender.includes('ชี้แจง') ? '1px solid #2563eb50' : '1px dashed #475569'))) : '1px solid #334155', color: '#fff', whiteSpace: 'pre-line' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input type="text" placeholder={`พิมพ์แชทตอบโต้...`} value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} style={{ flex: 1, padding: '10px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '10px', color: '#fff', outline: 'none' }} />
                <button type="submit" style={{ backgroundColor: '#2563eb', border: 'none', color: '#fff', padding: '0 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>ส่ง</button>
              </form>
            </div>

            <div style={{ backgroundColor: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
              <h5 style={{ margin: 0, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>🏦 ระบบตรวจสอบและจัดการเงิน</h5>
              
              {myRole === 'คนขาย' && !isPayoutSaved && (
                <form onSubmit={handleSavePayoutInfo} style={{ border: '1px solid #ef444450', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ backgroundColor: '#ef444415', border: '1px solid #ef4444', padding: '8px', borderRadius: '6px', color: '#f87171', fontSize: '11px', lineHeight: '1.4', fontWeight: 'bold', textAlign: 'center' }}>
                    ⚠️ โปรดใส่ชื่อและเบอร์ธนาคาร ก่อนกดยืนยัน หากใส่เบอร์ผิดทางแอดมินจะไม่ขอรับผิดชอบใดๆ <br />
                    <span style={{color: '#60a5fa'}}>📌 (ข้อมูลจะยิงตรงเข้า LINE แอดมินทันทีเมื่อซื้อขายสำเร็จ ได้เงินไวแน่นอน)</span>
                  </div>

                  <span style={{ fontSize: '11.5px', color: '#f59e0b', fontWeight: 'bold', display: 'block', textAlign: 'center', marginTop: '4px' }}>💰 กรอกข้อมูลบัญชีรับเงินของคุณ</span>

                  <select 
                    value={sellerPayoutInfo.payoutType} 
                    onChange={(e) => setSellerPayoutInfo({...sellerPayoutInfo, payoutType: e.target.value})}
                    style={{ padding: '8px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <option value="ธนาคารกสิกรไทย">ธนาคารกสิกรไทย (K-Bank)</option>
                    <option value="ธนาคารกรุงไทย">ธนาคารกรุงไทย (KTB)</option>
                    <option value="ธนาคารไทยพาณิชย์">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงเทพ">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="ธนาคารออมสิน">ธนาคารออมสิน (GSB)</option>
                    <option value="ธนาคารกรุงศรีอยุธยา">ธนาคารกรุงศรีอยุธยา (BAY)</option>
                    <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                    <option value="TrueMoney Wallet">TrueMoney Wallet</option>
                  </select>

                  <input 
                    type="text" 
                    placeholder="เลขบัญชี / เบอร์พร้อมเพย์ / เบอร์วอลเล็ต" 
                    value={sellerPayoutInfo.accountNo}
                    onChange={(e) => setSellerPayoutInfo({...sellerPayoutInfo, accountNo: e.target.value})}
                    style={{ padding: '8px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    required
                  />

                  <input 
                    type="text" 
                    placeholder="ชื่อ-นามสกุล เจ้าของบัญชี" 
                    value={sellerPayoutInfo.accountName}
                    onChange={(e) => setSellerPayoutInfo({...sellerPayoutInfo, accountName: e.target.value})}
                    style={{ padding: '8px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    required
                  />

                  <button type="submit" style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}>
                    🔒 ยืนยันและล็อกข้อมูลบัญชีนี้
                  </button>
                </form>
              )}

              {isPayoutSaved && (
                <div style={{ backgroundColor: '#10b98110', border: '1px dashed #10b98150', padding: '10px', borderRadius: '8px', fontSize: '11.5px', color: '#cbd5e1' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🔒 บัญชีคนขายล็อกในระบบแล้ว:</span>
                  <div>🏦 ช่องทาง: {sellerPayoutInfo.payoutType}</div>
                  <div>💳 เลขบัญชี/เบอร์: {sellerPayoutInfo.accountNo}</div>
                  <div>👤 ชื่อบัญชี: {sellerPayoutInfo.accountName}</div>
                  
                  {myRole === 'คนขาย' && dealStatusStep < 3 && (
                    <button 
                      onClick={handleUnlockPayoutInfo}
                      style={{ marginTop: '8px', width: '100%', padding: '6px', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✏️ ปลดล็อกเพื่อแก้ไขข้อมูล (กรอกผิด)
                    </button>
                  )}
                </div>
              )}

              {myRole === 'คนซื้อ' && dealStatusStep === 1 && (
                <div style={{ border: '1px dashed #334155', padding: '12px', borderRadius: '10px', textAlign: 'center', backgroundColor: '#1e293b50' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <button type="button" onClick={() => setPaymentMethod('bank')} style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '6px', border: paymentMethod === 'bank' ? '1px solid #3b82f6' : '1px solid #334155', backgroundColor: paymentMethod === 'bank' ? '#3b82f620' : '#020617', color: '#fff' }}>🏦 ธนาคาร</button>
                    <button type="button" onClick={() => setPaymentMethod('wallet')} style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '6px', border: paymentMethod === 'wallet' ? '1px solid #f59e0b' : '1px solid #334155', backgroundColor: paymentMethod === 'wallet' ? '#f59e0b20' : '#020617', color: '#fff' }}>🧡 Wallet</button>
                  </div>

                  <div style={{ backgroundColor: '#020617', border: '1px solid #334155', padding: '10px', borderRadius: '8px', marginBottom: '12px', textAlign: 'left', fontSize: '12px' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginBottom: '4px', textAlign: 'center' }}>
                      {paymentMethod === 'bank' ? '🏦 บัญชีธนาคารแอนมินคนกลาง' : '🧡 Wallet แอนมินคนกลาง'}
                    </span>
                    {paymentMethod === 'bank' ? (
                      <>
                        <div style={{ color: '#fff' }}><strong>ธนาคาร:</strong> กสิกรไทย (K-Bank)</div>
                        <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', margin: '2px 0' }}><strong>เลขบัญชี:</strong> 123-4-56789-0</div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: '#fff' }}><strong>ช่องทาง:</strong> TrueMoney Wallet</div>
                        <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', margin: '2px 0' }}><strong>เบอร์วอลเล็ต:</strong> 081-234-5678</div>
                      </>
                    )}
                    <div style={{ color: '#10b981' }}><strong>ชื่อบัญชี:</strong> นาย กรวินท์</div>
                  </div>

                  <span style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
                    ยอดเงินโอน: <strong>{activeChat.price.toLocaleString()} บาท</strong> เข้าบัญชีแอนมิน
                  </span>

                  <div style={{ marginBottom: '12px', textAlign: 'left' }}>
                    <label style={{ display: 'none' }} htmlFor="mobile-slip-upload">อัปโหลดสลิป</label>
                    <input 
                      id="mobile-slip-upload"
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      style={{ display: 'none' }} 
                      disabled={isVerifyingSlip}
                    />
                    
                    <div 
                      onClick={() => !isVerifyingSlip && document.getElementById('mobile-slip-upload').click()}
                      style={{
                        border: '2px dashed #3b82f6',
                        backgroundColor: '#020617',
                        padding: '16px 10px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        color: selectedSlipFile ? '#10b981' : '#94a3b8'
                      }}
                    >
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{selectedSlipFile ? '🖼️' : '📸'}</div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: selectedSlipFile ? '#10b981' : '#60a5fa' }}>
                        {selectedSlipFile ? 'เลือกรูปภาพสลิปแล้ว!' : 'กดตรงนี้เพื่อเลือกรูปสลิป / คิวอาร์โค้ด'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                        {selectedSlipFile ? `(${selectedSlipFile.name})` : 'เปิดคลังรูปภาพในมือถือของคุณ'}
                      </div>
                    </div>
                  </div>

                  {slipErrorMessage && (
                    <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '8px', fontWeight: 'bold' }}>
                      {slipErrorMessage}
                    </div>
                  )}

                  <button 
                    onClick={handleRealSlipVerification}
                    disabled={isVerifyingSlip || !selectedSlipFile} 
                    style={{ 
                      backgroundColor: (!selectedSlipFile || isVerifyingSlip) ? '#475569' : '#10b981', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '10px', 
                      borderRadius: '8px', 
                      fontWeight: 'bold', 
                      cursor: (!selectedSlipFile || isVerifyingSlip) ? 'not-allowed' : 'pointer', 
                      fontSize: '11.5px', 
                      width: '100%' 
                    }}
                  >
                    {isVerifyingSlip ? '⏳ กำลังส่งรูปไปธนาคารและสแกนสลิปออโต้...' : '🚀 ยืนยันอัปโหลดและส่งตรวจสลิป'}
                  </button>
                </div>
              )}

              {myRole === 'คนซื้อ' && dealStatusStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={handleConfirmReleaseMoney} style={{ width: '100%', backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                    🤝 ตรวจสอบรหัสเรียบร้อยแล้ว ส่งเรื่องเข้าคิวโอนเงินสด
                  </button>
                  {timeLeft === 0 && (
                    <button onClick={handleRefundBuyer} style={{ width: '100%', backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                      ↩️ เกินเวลากำหนด: กดยกเลิกดีลและดึงเงินคืน
                    </button>
                  )}
                </div>
              )}

              {dealStatusStep === 3 && (
                <div style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#10b98110', padding: '12px 10px', borderRadius: '8px', border: '1px dashed #10b981', lineHeight: '1.4' }}>
                  🎉 ทำการซื้อขายสำเร็จ <br />
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>PROMPT: โปรดรอแอดมินทำการโอนเงินเข้าบัญชีสักครู่</span>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '4px 0' }} />
              <button onClick={handleSummonAdmin} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🚨 เรียกแอดมิน</button>
            </div>
          </div>

        </div>
      )}

      {/* 🛡️ แผงควบคุมระบบแอดมินสูงสุด */}
      <div style={{ marginTop: '32px', backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '2px solid #ef4444' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#f87171', fontWeight: '800' }}>🛡️ แผงควบคุมระบบแอดมินสูงสุด + 📋 รายการคิวรออนุมัติโอนเงินสดทันที</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#94a3b8' }}>ส่วนควบคุมสำหรับคุณกรวินท์ เมื่อเสียง LINE แจ้งเตือนเด้งปุ๊บ มาดูรายชื่อที่ตารางนี้ กดปุ่มคัดลอกเลขบัญชีไปวางในแอปธนาคารเพื่อโอนได้ทันทีคราฟ</p>

        {/* 📋 รายการงานโอนเงินสด */}
        <div style={{ backgroundColor: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #475569', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b', display: 'block', marginBottom: '10px' }}>📊 รายการใบสั่งโอนเงินสด (ลิงก์ข้อมูลตามที่ยิงเข้า LINE Notify):</span>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '6px' }}>รหัสคิว</th>
                  <th style={{ padding: '6px' }}>รหัสดีล</th>
                  <th style={{ padding: '6px' }}>ช่องทาง</th>
                  <th style={{ padding: '6px' }}>เลขบัญชี/เบอร์ (กดก๊อปได้)</th>
                  <th style={{ padding: '6px' }}>ชื่อบัญชี</th>
                  <th style={{ padding: '6px' }}>ยอดสุทธิ</th>
                  <th style={{ padding: '6px' }}>สถานะ</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {adminPayoutQueue.map((queue) => (
                  <tr key={queue.id} style={{ borderBottom: '1px solid #222530', color: '#fff' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#f87171' }}>{queue.id}</td>
                    <td style={{ padding: '8px', color: '#60a5fa' }}>{queue.tradeId}</td>
                    <td style={{ padding: '8px' }}>{queue.payoutType}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ fontFamily: 'monospace', backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>{queue.accountNo}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(queue.accountNo);
                          alert(`📋 คัดลอกเลขบัญชี ${queue.accountNo} ใส่คลิปบอร์ดแล้ว! สามารถเอาไปวางในแอปธนาคารได้เลยคราฟน้า`);
                        }}
                        style={{ padding: '2px 6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                      >
                        📄 ก๊อปปี้
                      </button>
                    </td>
                    <td style={{ padding: '8px', color: '#cbd5e1' }}>{queue.accountName}</td>
                    <td style={{ padding: '8px', color: '#10b981', fontWeight: 'bold' }}>{queue.amount.toLocaleString()} บ.</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ color: queue.status.includes('✅') ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{queue.status}</span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {queue.status.includes('⏳') ? (
                        <button 
                          onClick={() => handleConfirmPayoutDone(queue.id, queue.tradeId)}
                          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                        >
                          💰 ยืนยันว่าฉันโอนสดแล้ว
                        </button>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '11px' }}>🔒 โอนเรียบร้อย</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          
          <div style={{ backgroundColor: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <form onSubmit={handleAdminInvestigate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 'bold' }}>🔎 ระบุ UID ผู้ใช้ หรือ รหัสดีล (เช่น TX-001 หรือ EG-95421)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="ใส่ UID หรือเลขดีลเพื่อส่องตรวจ..." 
                  value={searchUidInput}
                  onChange={(e) => setSearchUidInput(e.target.value)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  required
                />
                <button type="submit" style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>ส่องแชท</button>
              </div>
            </form>

            <div style={{ marginTop: '16px', borderTop: '1px dashed #334155', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🚫 บัญชีดำที่ถูกแบนอยู่ปัจจุบัน ({bannedUids.length}):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {bannedUids.map((uid, index) => (
                  <span key={index} style={{ backgroundColor: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'mono' }}>{uid} (Banned)</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #334155', minHeight: '180px' }}>
            {adminInvestigationResult ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: '#10b981', fontWeight: 'bold' }}>📂 พบข้อมูลดีล: {adminInvestigationResult.trade.id} ({adminInvestigationResult.trade.game})</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleAdminBanUser(adminInvestigationResult.trade.buyerUid)} style={{ backgroundColor: '#ef444420', border: '1px solid #ef4444', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🚫 แบนคนซื้อ</button>
                    <button onClick={() => handleAdminBanUser(adminInvestigationResult.trade.sellerUid)} style={{ backgroundColor: '#ef444420', border: '1px solid #ef4444', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🚫 แบนคนขาย</button>
                  </div>
                </div>

                <div style={{ height: '110px', overflowY: 'auto', backgroundColor: '#1e293b40', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {adminInvestigationResult.logs.map((log, index) => (
                    <div key={index} style={{ fontSize: '11.5px', borderBottom: '1px dashed #33415530', paddingBottom: '4px' }}>
                      <strong style={{ color: log.isSystem ? '#f87171' : '#60a5fa' }}>{log.sender}:</strong> <span style={{ color: '#e2e8f0' }}>{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#475569', fontSize: '12.5px', textAlign: 'center' }}>
                🔒 ระบบส่องแชทว่างอยู่ <br /> โปรดกรอก UID หรือเลขดีลด้านซ้ายมือเพื่อดึงหลักฐานแชทลับขึ้นมาตรวจสอบคราฟ
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 📝 ตู้จดหมายคำแนะนำ */}
      <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid #334155', paddingTop: '24px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#60a5fa' }}>📩 ช่องทางเสนอแนะ & แจ้งปรับปรุงระบบ</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8' }}>พบเจอบั๊ก ระบบเอ๋อ หรืออยากให้แอดมินเพิ่มฟีเจอร์อะไร พิมพ์บอกที่ช่องนี้ได้เลยคราฟ!</p>
          <form onSubmit={handleSendFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea rows="3" placeholder="พิมพ์รายละเอียดปัญหา..." value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'none' }} required />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>🚀 ส่งข้อมูลให้แอดมิน</button>
          </form>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#10b981' }}>📬 ตู้จดหมายของแอดมิน (ข้อความจากผู้ใช้บริการ)</h3>
          <div style={{ flex: 1, backgroundColor: '#020617', borderRadius: '10px', padding: '12px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #334155' }}>
            {feedbackList.map((fb) => (
              <div key={fb.id} style={{ backgroundColor: '#1e293b50', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>👤 จาก: {fb.user}</span>
                  <span style={{ color: '#475569' }}>🕒 {fb.date}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#e2e8f0', lineHeight: '1.4' }}>📢 {fb.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
