import { Inter, Cormorant_Garamond } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-serif',
});

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
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
