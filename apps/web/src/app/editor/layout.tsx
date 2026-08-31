export default function EditorLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
        {children}
      </main>
    );
  }