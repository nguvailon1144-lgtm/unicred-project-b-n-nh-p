'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { todayVN, addDaysVN, deadlineToVNIso, isDeadlineInFutureVN } from '@/lib/vietnamTime';
import { Job } from './JobCard';

interface CreateJobFormProps {
  activeUserId: string;
  userCredits: number;
  isVerified: boolean;
  onJobCreated: (newJob: Job) => void;
  onCreditsUpdated: (newCredits: number) => void;
}

const CATEGORIES = [
  { value: 'coding', label: '💻 Lập trình & Dev' },
  { value: 'design', label: '🎨 Thiết kế & Đồ họa' },
  { value: 'writing', label: '✍️ Viết lách & Content' },
  { value: 'translation', label: '🌐 Dịch thuật & Ngôn ngữ' },
  { value: 'video', label: '🎥 Làm video & Media' },
  { value: 'others', label: '⚙️ Việc khác' },
];

export default function CreateJobForm({
  activeUserId,
  userCredits,
  isVerified,
  onJobCreated,
  onCreditsUpdated,
}: CreateJobFormProps) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('coding');
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Default deadline (7 days from now, Vietnam time)
  useEffect(() => {
    setDeadline(addDaysVN(todayVN(), 7));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Verification check
    if (!isVerified) {
      return setErrorMsg('Tài khoản của bạn chưa được xác thực thẻ sinh viên! Vui lòng chờ quản trị viên duyệt để có thể đăng việc.');
    }

    // Validations
    if (!title.trim()) return setErrorMsg('Vui lòng nhập tiêu đề công việc.');
    
    const numericPrice = Math.floor(Number(price));
    if (!price || isNaN(numericPrice) || numericPrice <= 0) {
      return setErrorMsg('Vui lòng nhập ngân sách hợp lệ lớn hơn 0đ.');
    }

    // Credits check (20 staking credits required)
    if (userCredits < 20) {
      return setErrorMsg('Số Credits không đủ! Bạn cần có ít nhất 20 credits để đặt cọc khi đăng việc.');
    }

    if (!description.trim()) return setErrorMsg('Vui lòng nhập mô tả chi tiết công việc.');

    if (!isDeadlineInFutureVN(deadline)) {
      return setErrorMsg('Vui lòng chọn thời hạn hoàn thành trong tương lai.');
    }

    setIsSubmitting(true);

    // AI content moderation check
    const ACADEMIC_CHEATING_KEYWORDS = ['thi hộ', 'chạy điểm', 'thi giùm', 'học hộ', 'gian lận', 'hack', 'lừa đảo', 'cheat', 'thi dùm', 'đăng hộ'];
    let isFlagged = false;
    let flaggedReason: string | null = null;

    const contentToScan = `${title.toLowerCase()} ${description.toLowerCase()}`;
    const detectedKeyword = ACADEMIC_CHEATING_KEYWORDS.find(keyword => contentToScan.includes(keyword));

    if (detectedKeyword) {
      isFlagged = true;
      flaggedReason = `Phát hiện từ khóa nghi ngờ gian lận học thuật hoặc lừa đảo: "${detectedKeyword}" (AI Content-Scan)`;
      console.warn(`[Job AI Moderation] Gắn cờ tin tuyển dụng "${title}" vì từ khóa: ${detectedKeyword}`);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      let data: any = null;
      let insertError: any = null;

      try {
        const result = await (supabase
          .from('jobs')
          .insert([
            {
              title: title.trim(),
              description: description.trim(),
              price: numericPrice,
              status: 'open',
              owner_id: activeUserId,
              deadline: deadlineToVNIso(deadline),
              category,
              location: location.trim() || 'Online',
              is_flagged: isFlagged,
              flagged_reason: flaggedReason,
            },
          ])
          .select()
          .single() as any);
        clearTimeout(timeoutId);
        data = result.data;
        insertError = result.error;
      } catch (abortErr: any) {
        clearTimeout(timeoutId);
        if (abortErr?.name === 'AbortError' || controller.signal.aborted) {
          throw new Error('Yêu cầu hết thời gian chờ (30 giây). Vui lòng kiểm tra kết nối và thử lại.');
        }
        throw abortErr;
      }

      if (insertError) throw insertError;

      if (data) {
        supabase
          .from('users')
          .update({ credits: Math.max(0, userCredits - 20) })
          .eq('id', activeUserId)
          .then(({ error: creditErr }) => {
            if (creditErr) console.warn('[credits deduct]', creditErr.message);
          });

        setSuccessMsg(`Đăng việc thành công! Đã trừ 20 credits cọc.`);
        
        setTitle('');
        setPrice('');
        setDescription('');
        setLocation('');
        setCategory('coding');
        
        setDeadline(addDaysVN(todayVN(), 7));

        onCreditsUpdated(userCredits - 20);
        onJobCreated(data as Job);
      }
    } catch (err: any) {
      console.error('Error creating job:', err);
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình đăng việc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // COMMON INPUT CLASS TO KEEP UI CONSISTENT
  const inputClassName = "w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10";
  const labelClassName = "mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400";

  return (
    <div className="relative rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      
      {/* Header Section */}
      <div className="mb-8">
        <h2 className="mb-1.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          ✨ Đăng công việc
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Thuê sinh viên làm freelancer. <span className="font-bold text-indigo-500">20 credits</span> sẽ được đặt cọc và hoàn trả sau khi nghiệm thu.
        </p>
      </div>

      {/* Info/Error Banners */}
      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          <span className="text-lg">⚠️</span> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          <span className="text-lg">✓</span> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className={labelClassName}>
            Tiêu đề công việc
          </label>
          <input
            id="title"
            type="text"
            placeholder="Ví dụ: Lập trình Landing Page tuyển sinh FTU..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            className={inputClassName}
          />
        </div>

        {/* Category Selection */}
        <div>
          <label htmlFor="category" className={labelClassName}>
            Danh mục
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSubmitting}
            className={`${inputClassName} cursor-pointer appearance-none`}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Budget & Deadline Grid (Fixed Layout & Alignment) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Price */}
          <div>
            <label htmlFor="price" className={labelClassName}>
              Tiền công (VNĐ)
            </label>
            <div className
