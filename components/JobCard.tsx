'use client';

import React, { useState } from 'react';
import { formatDateVN } from '@/lib/vietnamTime';

export interface Job {
  id: string;
  title: string;
  description: string;
  price: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  owner_id: string;
  assigned_worker_id?: string | null;
  client_approved?: boolean;
  worker_approved?: boolean;
  deadline?: string;
  category: string;
  location?: string;
  created_at?: string;
  is_flagged?: boolean;
  owner?: {
    email: string;
    name?: string;
    is_verified?: boolean;
    client_reputation?: number;
    freelancer_reputation?: number;
    reputation?: number;
  };
}

export interface Application {
  id: string;
  job_id: string;
  user_id: string;
  created_at: string;
  user?: {
    email: string;
    name?: string;
    freelancer_reputation?: number;
    reputation?: number;
    university?: string;
  };
}

export interface Contract {
  id: string;
  job_id: string;
  worker_id: string;
  status: 'active' | 'completed';
  worker?: {
    email: string;
    name?: string;
    freelancer_reputation?: number;
    reputation?: number;
  };
}

interface JobCardProps {
  job: Job;
  activeUserId: string;
  activeView: 'hire' | 'earn';
  applications: Application[];
  applied: boolean;
  contract: Contract | null;
  onApply: (jobId: string) => Promise<void>;
  onAcceptApplicant: (jobId: string, workerId: string) => Promise<void>;
  onCompleteClick: (jobId: string, workerId: string) => void;
  onOpenChat: (jobId: string, workerId: string, otherName: string, jobTitle: string) => void;
  // New props for the Credit-Based Trust Platform
  onApproveCompletion?: (jobId: string, role: 'client' | 'worker') => Promise<void>;
  onOpenAppealModal?: (ratingId: string, jobTitle: string) => void;
  onOpenReviewModal?: (jobId: string, ratedUserId: string, jobTitle: string) => void;
  jobReviews?: any[];
  userAppeals?: any[];
  onWithdrawApplication?: (jobId: string) => Promise<void>;
  onDeleteJob?: (jobId: string) => Promise<void>;
}

const CATEGORY_MAP: Record<string, string> = {
  coding: '💻 Lập trình',
  design: '🎨 Thiết kế',
  writing: '✍️ Content',
  translation: '🌐 Dịch thuật',
  video: '🎥 Media',
  others: '⚙️ Việc khác',
};

export default function JobCard({
  job,
  activeUserId,
  activeView,
  applications = [],
  applied = false,
  contract = null,
  onApply,
  onAcceptApplicant,
  onCompleteClick,
  onOpenChat,
  onApproveCompletion,
  onOpenAppealModal,
  onOpenReviewModal,
  jobReviews = [],
  userAppeals = [],
  onWithdrawApplication,
  onDeleteJob,
}: JobCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  // 'withdraw' | 'delete' | null — tracks which inline confirm is showing
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const handleApply = async () => {
    setLoadingAction('apply');
    try {
      await onApply(job.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAccept = async (workerId: string) => {
    setLoadingAction(`accept-${workerId}`);
    try {
      await onAcceptApplicant(job.id, workerId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveClick = async (role: 'client' | 'worker') => {
    setLoadingAction(`approve-${role}`);
    try {
      if (onApproveCompletion) {
        await onApproveCompletion(job.id, role);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWithdraw = async () => {
    setConfirmAction(null);
    setLoadingAction('withdraw');
    try {
      if (onWithdrawApplication) await onWithdrawApplication(job.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    setConfirmAction(null);
    setLoadingAction('delete');
    try {
      if (onDeleteJob) await onDeleteJob(job.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Date parsing to dd/mm/yyyy (Vietnam timezone)
  const formatVietnameseDate = formatDateVN;

  // Extract reputations
  const ownerRep = job.owner?.client_reputation ?? job.owner?.reputation ?? 100;
  const isOwnerHighRisk = ownerRep < 40;

  const workerRep = contract?.worker?.freelancer_reputation ?? contract?.worker?.reputation ?? 100;
  const isWorkerHighRisk = workerRep < 40;

  // Reputation logs calculations
  const clientReview = jobReviews.find(r => r.job_id === job.id && r.rater_id === job.owner_id);
  const workerReview = jobReviews.find(r => r.job_id === job.id && r.rater_id === job.assigned_worker_id);

  const myReview = activeUserId === job.owner_id ? clientReview : workerReview;
  const partnerReview = activeUserId === job.owner_id ? workerReview : clientReview;

  const myAppeal = partnerReview ? userAppeals.find(a => a.reputation_log_id === partnerReview.id) : null;

  // SLA 72h check
  const isWithin72Hours = (createdAtString?: string) => {
    if (!createdAtString) return false;
    const createdDate = new Date(createdAtString);
    const limitDate = new Date(createdDate.getTime() + 72 * 60 * 60 * 1000);
    return new Date() < limitDate;
  };

  return (
    <div className="group relative flex flex-col justify-between h-full rounded-2xl border border-border-color bg-card-bg p-6 shadow-card transition-all duration-300 hover:border-indigo-500/30 hover:shadow-md">
      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          {/* Status Badge — contextual based on view and user role */}
          {job.status === 'open' && activeView === 'earn' && applied ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Đã ứng tuyển
            </span>
          ) : job.status === 'open' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đang tuyển
            </span>
          ) : null}
          {job.status === 'in_progress' && activeView === 'earn' && job.assigned_worker_id === activeUserId ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đã nhận
            </span>
          ) : job.status === 'in_progress' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              Đang hết
            </span>
          ) : null}
          {job.status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Đã hoàn thành
            </span>
          )}
          {job.status === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Đã hủy bỏ
            </span>
          )}

          {/* Budget: always show the actual job price */}
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {job.price.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors duration-200 line-clamp-1 mb-1">
          {job.title}
        </h3>

        {/* Category & Location Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
            {CATEGORY_MAP[job.category] || '⚙️ Khác'}
          </span>
          <span className="rounded bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-text-muted">
            📍 {job.location || 'Online'}
          </span>
          {activeView === 'earn' && isOwnerHighRisk && (
            <span className="rounded bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 animate-pulse">
              ⚠️ Tài khoản rủi ro cao
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-text-muted leading-relaxed mb-4 line-clamp-3">
          {job.description || 'Không có mô tả công việc.'}
        </p>

        {/* Info detail labels */}
        <div className="grid grid-cols-2 gap-2 text-xs text-text-muted bg-background border border-border-color rounded-xl p-3 mb-4">
          <div>
            <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">
              Đăng bởi
            </span>
            <span className="font-semibold text-foreground truncate block flex items-center gap-1">
              👤 {job.owner?.name || job.owner?.email?.split('@')[0] || 'Khách'}
              {job.owner?.is_verified && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400" title="Sinh viên đã xác thực">✓</span>
              )}
            </span>
            <span className="text-[10px] text-text-muted font-medium block mt-0.5">
              ⭐ Uy tín: {ownerRep}/100
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">
              Hạn hoàn thành
            </span>
            <span className="font-semibold text-rose-500 flex items-center gap-1">
              📅 {formatVietnameseDate(job.deadline)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Contextual controls based on role view */}
      <div className="mt-auto pt-4 border-t border-border-color">
        
        {/* ======================================================== */}
        {/* EMPLOYER VIEW: HIRE OPTIONS                              */}
        {/* ======================================================== */}
        {activeView === 'hire' && (
          <div className="space-y-4">
            {/* 1. Job is open: Show candidates list */}
            {job.status === 'open' && (
              <div>
                <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Danh sách ứng tuyển ({applications.length})
                </span>
                
                {applications.length === 0 ? (
                  <p className="text-xs text-text-muted italic py-1">Chưa có sinh viên ứng tuyển...</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {applications.map((app) => {
                      const appRep = app.user?.freelancer_reputation ?? app.user?.reputation ?? 100;
                      const appIsHighRisk = appRep < 40;

                      return (
                        <div
                          key={app.id}
                          className="flex items-center justify-between gap-3 bg-background border border-border-color rounded-xl p-2.5 shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-foreground truncate flex items-center gap-1">
                              {app.user?.name || app.user?.email || 'Sinh Viên'}
                              {appIsHighRisk && (
                                <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1 rounded border border-rose-200">⚠️ Rủi ro</span>
                              )}
                            </span>
                            <span className="block text-[9px] text-text-muted font-medium truncate">
                              🏫 {app.user?.university || 'Trường Đại học'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-bold mt-0.5">
                              ⭐ Uy tín: {appRep}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenChat(job.id, app.user_id, app.user?.name || app.user?.email || 'Sinh Viên', job.title)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-slate-200"
                              title="Nhắn tin trò chuyện"
                            >
                              💬
                            </button>
                            <button
                              onClick={() => handleAccept(app.user_id)}
                              disabled={loadingAction !== null}
                              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-bold text-white px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                            >
                              {loadingAction === `accept-${app.user_id}` ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent border-white" />
                              ) : (
                                'Xác nhận'
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Delete job button — only owner, only when open */}
            {job.status === 'open' && job.owner_id === activeUserId && onDeleteJob && (
              <div className="mt-3">
                {confirmAction === `delete-${job.id}` ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-rose-400/30 bg-rose-500/5 p-3">
                    <p className="text-xs font-bold text-rose-600 text-center">
                      ⚠️ Bạn có chắc chắn muốn xóa bài đăng này không?
                    </p>
                    <p className="text-[10px] text-rose-500 text-center">Hành động này không thể hoàn tác.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="flex-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold py-1.5 hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={loadingAction === 'delete'}
                        className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold py-1.5 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        {loadingAction === 'delete' ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent border-white" />
                        ) : (
                          'Xóa bài đăng'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmAction(`delete-${job.id}`)}
                    disabled={loadingAction !== null}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 text-xs font-bold py-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    🗑️ Xóa bài đăng
                  </button>
                )}
              </div>
            )}

            {/* 2. Job in progress: Show contract info & dual approval completion buttons */}
            {job.status === 'in_progress' && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs flex justify-between items-center">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase text-text-muted font-bold mb-1">Người làm việc</span>
                    <span className="font-bold text-foreground block truncate flex items-center gap-1">
                      👤 {contract?.worker?.name || contract?.worker?.email || 'Freelancer'}
                      {isWorkerHighRisk && (
                        <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 rounded border border-rose-200">⚠️ Rủi ro cao</span>
                      )}
                    </span>
                    <span className="block text-[9px] text-text-muted mt-0.5">⭐ Uy tín: {workerRep}/100</span>
                  </div>
                  <button
                    onClick={() => {
                      const wId = contract?.worker_id || job.assigned_worker_id || '';
                      // Try to get name from contract, then from applications list
                      const appMatch = applications.find((a) => a.user_id === wId);
                      const wName = contract?.worker?.name
                        || contract?.worker?.email?.split('@')[0]
                        || appMatch?.user?.name
                        || appMatch?.user?.email?.split('@')[0]
                        || 'Người nhận việc';
                      onOpenChat(job.id, wId, wName, job.title);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    💬 Nhắn tin
                  </button>
                </div>

                {/* Completion checklist status */}
                <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Đối tác (Freelancer) hoàn thành:</span>
                    <span className={`font-bold ${job.worker_approved ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {job.worker_approved ? '✓ Đã báo cáo' : '⏳ Chưa báo cáo'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Chủ việc (Bạn) duyệt:</span>
                    <span className={`font-bold ${job.client_approved ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {job.client_approved ? '✓ Đã duyệt' : '⏳ Chưa duyệt'}
                    </span>
                  </div>
                </div>

                {!job.client_approved ? (
                  <button
                    onClick={() => handleApproveClick('client')}
                    disabled={loadingAction !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {loadingAction === 'approve-client' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border border-t-transparent border-white" />
                    ) : (
                      '✔️ Xác nhận hoàn thành (Duyệt)'
                    )}
                  </button>
                ) : (
                  <div className="text-center text-xs font-bold text-emerald-600 py-1">
                    Bạn đã duyệt hoàn thành. Chờ freelancer xác nhận.
                  </div>
                )}
              </div>
            )}

            {/* 3. Job is completed: Review & Appeal controls */}
            {job.status === 'completed' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 justify-center">
                  Hợp đồng hoàn thành & Giải ngân cọc (+10 thưởng)
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {/* Rate worker button */}
                  {!myReview ? (
                    <button
                      onClick={() => onOpenReviewModal && onOpenReviewModal(job.id, job.assigned_worker_id || '', job.title)}
                      className="w-full text-center text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl py-2 hover:bg-indigo-100 transition-all cursor-pointer"
                    >
                      ⭐ Đánh giá Freelancer (Đánh giá ẩn)
                    </button>
                  ) : (
                    <div className="text-center text-xs text-text-muted bg-slate-100 rounded-xl py-2 border border-slate-200">
                      Bạn đã đánh giá Freelancer: {myReview.stars} ⭐
                    </div>
                  )}

                  {/* Partner review and Appeal if low */}
                  {partnerReview && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                      {partnerReview.is_visible_to_public ? (
                        <div>
                          <p className="font-semibold text-foreground mb-1">
                            Freelancer đánh giá bạn: {partnerReview.stars} ⭐
                          </p>
                          {partnerReview.comment && (
                            <p className="text-text-muted italic">"{partnerReview.comment}"</p>
                          )}
                          
                          {/* SLA 72h Appeal option if rating is low (<=2 stars) */}
                          {partnerReview.stars <= 2 && !myAppeal && isWithin72Hours(partnerReview.created_at) && (
                            <button
                              onClick={() => onOpenAppealModal && onOpenAppealModal(partnerReview.id, job.title)}
                              className="mt-2 text-rose-500 font-bold hover:underline cursor-pointer text-[11px]"
                            >
                              ⚖️ Khiếu nại điểm phạt (SLA 72h)
                            </button>
                          )}
                          
                          {myAppeal && (
                            <div className="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                              Trạng thái khiếu nại: {myAppeal.status === 'Disputed_Frozen' ? 'Đang tranh chấp (Đóng băng)' : 'Đã giải quyết'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-text-muted italic text-[11px]">
                          🔒 Đánh giá của Freelancer đang bị ẩn (Sẽ mở khi bạn hoàn thành đánh giá hoặc sau 72h).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 4. Job is cancelled */}
            {job.status === 'cancelled' && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 justify-center">
                Công việc đã bị hủy bỏ.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* FREELANCER VIEW: EARN OPTIONS                            */}
        {/* ======================================================== */}
        {activeView === 'earn' && (
          <div>
            {/* 1. Job is open: Show apply buttons */}
            {job.status === 'open' && (
              <>
                {applied ? (
                  <div className="flex flex-col gap-2">
                    {confirmAction === `withdraw-${job.id}` ? (
                      <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 space-y-2">
                        <p className="text-xs font-bold text-amber-700 text-center">
                          Bạn muốn rút đơn ứng tuyển khỏi công việc này?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="flex-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold py-1.5 hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Không, giữ lại
                          </button>
                          <button
                            onClick={handleWithdraw}
                            disabled={loadingAction === 'withdraw'}
                            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-bold py-1.5 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            {loadingAction === 'withdraw' ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent border-white" />
                            ) : (
                              'Rút đơn'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmAction(`withdraw-${job.id}`)}
                          disabled={loadingAction !== null}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-rose-600 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Đã ứng tuyển
                        </button>
                        <button
                          onClick={() => onOpenChat(job.id, activeUserId, job.owner?.name || job.owner?.email?.split('@')[0] || 'Nhà tuyển dụng', job.title)}
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          💬 Nhắn tin
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={loadingAction !== null || job.owner_id === activeUserId}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
                  >
                    {loadingAction === 'apply' ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border border-t-transparent border-white" />
                        Đang ứng tuyển...
                      </>
                    ) : job.owner_id === activeUserId ? (
                      'Bài đăng của bạn'
                    ) : (
                      'Ứng tuyển — ' + job.price.toLocaleString('vi-VN') + 'đ'
                    )}
                  </button>
                )}
              </>
            )}

            {/* 2. Job in progress: Show contract info & reported approval status */}
            {job.status === 'in_progress' && (
              <>
                {job.assigned_worker_id === activeUserId ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 justify-center">
                      <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
                      Bạn đã được giao việc! Hãy bắt đầu làm việc.
                    </div>

                    {/* Completion Checklist */}
                    <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Bạn (Freelancer) báo cáo hoàn thành:</span>
                        <span className={`font-bold ${job.worker_approved ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {job.worker_approved ? '✓ Đã báo cáo' : '⏳ Chưa báo cáo'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Nhà tuyển dụng duyệt:</span>
                        <span className={`font-bold ${job.client_approved ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {job.client_approved ? '✓ Đã duyệt' : '⏳ Chưa duyệt'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!job.worker_approved ? (
                        <button
                          onClick={() => handleApproveClick('worker')}
                          disabled={loadingAction !== null}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer shadow-md disabled:opacity-50"
                        >
                          {loadingAction === 'approve-worker' ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent border-white" />
                          ) : (
                            '✔️ Báo cáo đã hoàn thành'
                          )}
                        </button>
                      ) : (
                        <div className="flex-1 text-center text-xs font-bold text-emerald-600 py-2.5 bg-emerald-50 border border-emerald-250 rounded-xl">
                          Bạn đã báo cáo hoàn thành. Chờ đối tác duyệt.
                        </div>
                      )}
                      <button
                        onClick={() => onOpenChat(job.id, activeUserId, job.owner?.name || job.owner?.email?.split('@')[0] || 'Nhà tuyển dụng', job.title)}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        💬 Chat
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border-color bg-slate-100 dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-text-muted cursor-not-allowed"
                  >
                    Đã có người nhận việc
                  </button>
                )}
              </>
            )}

            {/* 3. Job is completed: Review & Appeal options */}
            {job.status === 'completed' && (
              <>
                {job.assigned_worker_id === activeUserId ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 justify-center">
                      🎉 Hoàn thành! Nhận lại cọc và +10 credits thưởng
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Rate client button */}
                      {!myReview ? (
                        <button
                          onClick={() => onOpenReviewModal && onOpenReviewModal(job.id, job.owner_id, job.title)}
                          className="w-full text-center text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl py-2 hover:bg-indigo-100 transition-all cursor-pointer"
                        >
                          ⭐ Đánh giá Nhà tuyển dụng (Đánh giá ẩn)
                        </button>
                      ) : (
                        <div className="text-center text-xs text-text-muted bg-slate-100 rounded-xl py-2 border border-slate-200">
                          Bạn đã đánh giá Nhà tuyển dụng: {myReview.stars} ⭐
                        </div>
                      )}

                      {/* Partner review and Appeal if low */}
                      {partnerReview && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                          {partnerReview.is_visible_to_public ? (
                            <div>
                              <p className="font-semibold text-foreground mb-1">
                                Nhà tuyển dụng đánh giá bạn: {partnerReview.stars} ⭐
                              </p>
                              {partnerReview.comment && (
                                <p className="text-text-muted italic">"{partnerReview.comment}"</p>
                              )}
                              
                              {/* SLA 72h Appeal option if rating is low (<=2 stars) */}
                              {partnerReview.stars <= 2 && !myAppeal && isWithin72Hours(partnerReview.created_at) && (
                                <button
                                  onClick={() => onOpenAppealModal && onOpenAppealModal(partnerReview.id, job.title)}
                                  className="mt-2 text-rose-500 font-bold hover:underline cursor-pointer text-[11px]"
                                >
                                  ⚖️ Khiếu nại điểm phạt (SLA 72h)
                                </button>
                              )}
                              
                              {myAppeal && (
                                <div className="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                                  Trạng thái khiếu nại: {myAppeal.status === 'Disputed_Frozen' ? 'Đang tranh chấp (Đóng băng)' : 'Đã giải quyết'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-text-muted italic text-[11px]">
                              🔒 Đánh giá của Nhà tuyển dụng đang bị ẩn (Sẽ mở khi bạn hoàn thành đánh giá hoặc sau 72h).
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border-color bg-slate-100 dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-text-muted cursor-not-allowed"
                  >
                    Công việc đã kết thúc
                  </button>
                )}
              </>
            )}
            
            {/* 4. Job is cancelled */}
            {job.status === 'cancelled' && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 justify-center">
                Công việc đã bị hủy bởi chủ việc. Cọc 30 credits của bạn đã bị tịch thu.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
