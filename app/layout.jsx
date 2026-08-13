import "./globals.css";

export const metadata = {
  title: "CPF Philippines · Project Budget Control",
  description: "AI Program budget & profit/loss dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
