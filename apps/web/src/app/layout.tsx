import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { THEME_SCRIPT } from "@/app/utils/theme";
import { APP_TITLE } from "@/app/utils/unread";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Chat de equipe com agentes de IA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // O script do <head> põe o tema antes da hidratação: o atributo não vem do servidor.
    <html lang="pt-BR" className={`${lato.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Um <script> nativo, e não o next/script: com beforeInteractive, o App Router o entrega pelo
            próprio runtime, depois do JavaScript da aplicação, e o tema chegaria depois da
            primeira pintura. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
