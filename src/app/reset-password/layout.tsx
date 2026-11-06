import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | SNAPPY GIFTZ',
  description: 'Securely reset your password and protect your SNAPPY GIFTZ account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

