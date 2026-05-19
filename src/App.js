import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ArrowRight, Wallet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function App() {
  // จำลองสถานะของระบบ Escrow
  const [balance, setBalance] = useState(1000);
  const [escrowAmount, setEscrowAmount] = useState(500);
  const [step, setStep] = useState(1); // 1: เสนอสัญญา, 2: ผู้ซื้อโอนเงินเข้ากองกลาง, 3: ผู้ขายส่งของ, 4: ผู้ซื้อกดรับของ/เงินโอนให้ผู้ขาย
  const [logs, setLogs] = useState([
    { id: 1, text: "ระบบเปิดใช้งาน: รอผู้ซื้อและผู้ขายตกลงเงื่อนไข", time: "13:40" }
  ]);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{ id: Date.now(), text, time }, ...prev]);
  };

  const handleNextStep = () => {
    if (step === 1) {
      addLog(`ผู้ซื้อยินยอมล็อกเงินจำนวน ${escrowAmount} บาท เข้าสู่ระบบคนกลาง (Escrow)`);
      setBalance(prev => prev - escrowAmount);
      setStep(2);
    } else if (step === 2) {
      addLog("ผู้ขายรับทราบการวางเงินค้ำประกัน และทำการจัดส่งสินค้าเรียบร้อยแล้ว");
      setStep(3);
    } else if (step === 3) {
      addLog(`ผู้ซื้อตรวจสอบสินค้าแล้วถูกต้อง ระบบทำการโอนเงิน ${escrowAmount} บาท ให้ผู้ขายสำเร็จ`);
      setStep(4);
    }
  };

  const handleCancel = () => {
    if (step === 2 || step === 3) {
      addLog(`เกิดข้อพิพาท! ระบบ Escrow คืนเงิน ${escrowAmount} บาท กลับไปให้ผู้ซื้อเพื่อความปลอดภัย`);
      setBalance(prev => prev + escrowAmount);
    } else {
      addLog("ยกเลิกข้อตกลงสัญญา");
    }
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center justify-center bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ระบบคนกลางค้ำประกันสินค้า</h1>
        <p className="text-slate-500 mt-2">Escrow Smart Contract Simulator</p>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* คอลัมน์ซ้ายและกลาง: แดชบอร์ดและขั้นตอน */}
        <div className="md:col-span-2 space-y-6">
          
          {/* การเงินและตู้เซฟกลาง */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">กระเป๋าเงินผู้ซื้อ</p>
                <p className="text-xl font-bold text-slate-700">{balance} THB</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">เงินในกองกลาง (Escrow)</p>
                <p className="text-xl font-bold text-blue-600">{step >= 2 && step < 4 ? escrowAmount : 0} THB</p>
              </div>
            </div>
          </div>

          {/* กล่องควบคุมสเตตัสเกม */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              สถานะสัญญาปัจจุบัน
            </h2>

            {/* แถบ Timeline แสดงความคืบหน้า */}
            <div className="relative flex justify-between items-center max-w-md mx-auto px-4">
              <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-10">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                ></div>
              </div>
              {[1, 2, 3, 4].map((num) => (
                <div 
                  key={num} 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                    step >= num 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200' 
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>

            {/* คำอธิบายสถานะ */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              {step === 1 && (
                <div>
                  <p className="font-semibold text-slate-700">ขั้นตอนที่ 1: ตั้งเงื่อนไขและมูลค่าซื้อขาย</p>
                  <p className="text-sm text-slate-500 mt-1">ผู้ซื้อและผู้ขายตกลงราคา แนะนำให้ล็อกเงินค้ำประกันไว้ที่ 500 บาทคราฟ</p>
                  <div className="mt-3 flex justify-center items-center gap-2">
                    <input 
                      type="number" 
                      value={escrowAmount} 
                      onChange={(e) => setEscrowAmount(Number(e.target.value))}
                      className="w-28 text-center p-1.5 border border-slate-200 rounded-lg font-bold focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-500">บาท</span>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <p className="font-semibold text-amber-600 flex items-center justify-center gap-1">
                    <ShieldAlert className="w-5 h-5" /> ขั้นตอนที่ 2: เงินถูกล็อกอยู่ในกองกลางแล้ว
                  </p>
                  <p className="text-sm text-slate-500 mt-1">ปลอดภัย 100% เงินจะไม่ไปถึงผู้ขายจนกว่าผู้ซื้อจะได้รับของ รอผู้ขายจัดส่งสินค้า</p>
                </div>
              )}
              {step === 3 && (
                <div>
                  <p className="font-semibold text-blue-600 flex items-center justify-center gap-1">
                    📦 ขั้นตอนที่ 3: ผู้ขายทำการส่งสินค้าแล้ว
                  </p>
                  <p className="text-sm text-slate-500 mt-1">กรุณารอรับของที่บ้าน เมื่อได้รับสินค้าแล้วให้กดตรวจสอบเพื่อปล่อยเงินให้ผู้ขาย</p>
                </div>
              )}
              {step === 4 && (
                <div>
                  <p className="font-semibold text-emerald-600 flex items-center justify-center gap-1">
                    <CheckCircle className="w-5 h-5" /> สัญญาเสร็จสิ้นสมบูรณ์!
                  </p>
                  <p className="text-sm text-slate-500 mt-1">ผู้ซื้อได้ของ ผู้ขายได้เงิน วินวินทั้งสองฝ่ายด้วยระบบ Escrow ปลอดภัยไร้โกง</p>
                </div>
              )}
            </div>

            {/* ปุ่มกดจำลองเหตุการณ์ */}
            <div className="flex gap-3">
              {step < 4 ? (
                <>
                  <button 
                    onClick={handleNextStep}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-md shadow-blue-100 flex items-center justify-center gap-2 transition"
                  >
                    {step === 1 && "ตกลงและล็อกเงินค้ำประกัน"}
                    {step === 2 && "จำลองสถานการณ์: ผู้ขายส่งสินค้า"}
                    {step === 3 && "ฉันได้รับสินค้าแล้ว (ปล่อยเงินกู้คืน)"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {step > 1 && (
                    <button 
                      onClick={handleCancel}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium py-3 px-4 rounded-xl border border-rose-100 flex items-center justify-center gap-1 transition"
                    >
                      <XCircle className="w-4 h-4" /> แจ้งข้อพิพาท/คืนเงิน
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => setStep(1)}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 px-4 rounded-xl transition"
                >
                  เริ่มจำลองสัญญาใหม่อีกครั้ง
                </button>
              )}
            </div>

          </div>
        </div>

        {/* คอลัมน์ขวา: ประวัติการทำงานระบบ (Logs) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[380px]">
          <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
            📜 ประวัติสัญญา (Smart Contract Logs)
          </h2>
          <div className="overflow-y-auto flex-1 space-y-3 pr-1 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg border-l-4 border-blue-500 space-y-1">
                <p className="text-slate-600 font-medium leading-relaxed">{log.text}</p>
                <span className="text-[10px] text-slate-400 block text-right">{log.time} น.</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
