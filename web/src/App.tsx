// ルータ + ルート定義。BrowserRouter + basename（docs/02 line 156: GitHub Pages 404.html フォールバック方針）。
// 公開ルート(/library, /library/:slug)は AuthGate の外（認証不要で誰でも読める）。
// それ以外（/, /c/:slug, /search, /proposals, /me）は AuthGate でラップした layout ルート配下に置く。
// AuthGate は Outlet ベースの AuthLayout として適用（private ルート群を一括で認証ゲート下に入れる）。
// mockモードでは AuthGate が素通しする（providerMode の解決に従う）ので挙動は不変。
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { MainCharacterProvider } from "./lib/mainCharacterContext";
import { CharacterListPage } from "./pages/CharacterListPage";
import { CharacterPage } from "./pages/CharacterPage";
import { MainCharacterPage } from "./pages/MainCharacterPage";
import { SearchPage } from "./pages/SearchPage";
import { ProposalsPage } from "./pages/ProposalsPage";
import { LibraryIndexPage } from "./pages/LibraryIndexPage";
import { ArticlePage } from "./pages/ArticlePage";

// 認証必須ルート群のレイアウト。AuthGate 配下で MainCharacterProvider を有効化し、Outlet に子ルートを描画する。
function AuthLayout() {
  return (
    <AuthGate>
      <MainCharacterProvider>
        <Outlet />
      </MainCharacterProvider>
    </AuthGate>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* 公開ルート（認証不要） */}
        <Route path="/library" element={<LibraryIndexPage />} />
        <Route path="/library/:slug" element={<ArticlePage />} />

        {/* 認証必須ルート（AuthGate 配下） */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<CharacterListPage />} />
          <Route path="/me" element={<MainCharacterPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/c/:slug" element={<CharacterPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
