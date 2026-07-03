// ルータ + ルート定義。BrowserRouter + basename（docs/02 line 156: GitHub Pages 404.html フォールバック方針）。
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { CharacterListPage } from "./pages/CharacterListPage";
import { CharacterPage } from "./pages/CharacterPage";
import { MainCharacterPage } from "./pages/MainCharacterPage";
import { SearchPage } from "./pages/SearchPage";
import { ProposalsPage } from "./pages/ProposalsPage";

export function App() {
  return (
    <AuthGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<CharacterListPage />} />
          <Route path="/me" element={<MainCharacterPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/c/:slug" element={<CharacterPage />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}
