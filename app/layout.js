import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Dyaus RangeSure · AI range and cost-per-km for electric trucks',
  description:
    'Will this electric truck make the trip, and what will each kilometre cost? An AI proof of concept by Dyaus Advisory, created by Hrishikesh Kumar.',
  applicationName: 'Dyaus RangeSure',
  authors: [{ name: 'Hrishikesh Kumar' }, { name: 'Dyaus Advisory', url: 'https://dyausadvisory.live' }],
  openGraph: {
    title: 'Dyaus RangeSure',
    description:
      'Predict range, price cost-per-km, and underwrite a route guarantee for electric trucks. An AI proof of concept by Dyaus Advisory.',
    siteName: 'Dyaus RangeSure',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
