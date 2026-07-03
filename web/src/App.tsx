// ルータ + ルート定義。BrowserRouter + basename（docs/02 line 156: GitHub Pages 404.html フォールバック方針）。
// 全ルートを AuthGate 配下の AuthLayout に集約（ライブラリ含む）。閲覧はオーナー or ゲスト（サンドボックス）でログイン。
// ゲストとログインなしの差がほぼ無いため、公開ルートの特別扱いは廃止しゲスト経由に一本化（シンプル化）。
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
        {/* 全ルートを AuthGate 配下に集約（オーナー or ゲストで閲覧） */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<CharacterListPage />} />
          <Route path="/me" element={<MainCharacterPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/c/:slug" element={<CharacterPage />} />
          <Route path="/library" element={<LibraryIndexPage />} />
          <Route path="/library/:slug" element={<ArticlePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
