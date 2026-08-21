import './globals.css';

export const metadata = {
  title: 'Tata RangeSure',
  description: 'Predicts real-time range and cost-per-km for electric truck fleets.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
