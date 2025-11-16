'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, LogIn, KeyRound, CheckCircle2 } from 'lucide-react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState('');
  const [formData, setFormData] = useState({ email: '', otp: '' });

  const handleSendOtp = async (email: string) => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال بريد إلكتروني صالح',
        variant: 'destructive',
      });
      return;
    }

    setSendingOtp(true);
    const result = await signInWithOtp(email);

    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message || 'فشل إرسال رمز التحقق',
        variant: 'destructive',
      });
      setSendingOtp(false);
      return;
    }

    setOtpSent(true);
    setEmailForOtp(email);
    toast({
      title: 'نجح',
      description: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
    });
    setSendingOtp(false);
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!otp || otp.length < 6) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رمز التحقق المكون من 6 أرقام',
        variant: 'destructive',
      });
      return;
    }

    setVerifyingOtp(true);
    const result = await verifyOtp(emailForOtp, otp, 'email');

    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message || 'رمز التحقق غير صحيح',
        variant: 'destructive',
      });
      setVerifyingOtp(false);
      return;
    }

    toast({
      title: 'نجح',
      description: 'تم تسجيل الدخول بنجاح',
    });

    setVerifyingOtp(false);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpSent) {
      await handleSendOtp(formData.email);
      return;
    }

    if (!formData.otp) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رمز التحقق',
        variant: 'destructive',
      });
      return;
    }

    await handleVerifyOtp(formData.otp);
  };

  const handleSendNewOtp = async () => {
    setOtpSent(false);
    setFormData({ ...formData, otp: '' });
    if (emailForOtp) {
      await handleSendOtp(emailForOtp);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            تسجيل الدخول
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            يرجى تسجيل الدخول للمتابعة
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!otpSent ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="example@email.com"
                  dir="rtl"
                  disabled={sendingOtp}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={sendingOtp || !formData.email}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    إرسال رمز التحقق
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">رمز التحقق</Label>
                <Input
                  id="otp"
                  type="text"
                  value={formData.otp}
                  onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="bg-slate-700 border-slate-600 text-white text-center text-lg tracking-widest"
                  placeholder="أدخل رمز التحقق المكون من 6 أرقام"
                  dir="ltr"
                  disabled={verifyingOtp}
                  maxLength={6}
                  required
                />
                <p className="text-xs text-slate-400 text-center">
                  تم إرسال رمز التحقق إلى {emailForOtp}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={verifyingOtp || !formData.otp || formData.otp.length < 6}
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    تحقق من الرمز
                  </>
                )}
              </Button>
              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleSendNewOtp}
                  className="text-sm text-blue-400 hover:text-blue-300 p-0 h-auto"
                  disabled={sendingOtp}
                >
                  إرسال رمز جديد
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
