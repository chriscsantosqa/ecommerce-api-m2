/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import "./index.css";
import { Toaster } from "react-hot-toast";

// Importando Provedores de Contexto
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import {
  NotificationProvider,
  useNotification,
} from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";

// Componentes Globais
import { QASidebar } from "./components/academy/QASidebar";
import { NotificationModal } from "./components/ui/NotificationModal";
import { Spinner } from "./components/ui/Spinner";
import { SalesToast } from "./components/ui/SalesToast";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { BookOpen } from "./components/shared/Icons";

// Páginas
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { CartPage } from "./pages/CartPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { SuccessPage } from "./pages/SuccessPage";
import { AdminPage } from "./pages/AdminPage";
import { SearchPage } from "./pages/SearchPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CategoryProductsPage } from "./pages/CategoryProductsPage";
import { OffersPage } from "./pages/OffersPage";

// Cliente GraphQL/API
import { graphqlClient } from "./api/client";

const AppContent = () => {
  const { isAuthenticated, loading, logout } = useAuth();
  const { showModal, modalState } = useNotification();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getInitialPage = () => {
    const path = window.location.pathname;
    if (path === "/reset-password") return "resetPassword";
    if (path === "/forgot-password") return "forgotPassword";
    return "login";
  };
  const [page, setPage] = useState(getInitialPage);

  useEffect(() => {
    const onAuthError = () => {
      logout();
      showModal({
        title: "Sessão Expirada",
        message: "Sua sessão expirou. Faça login novamente.",
        onConfirm: () => {},
      });
    };
    window.addEventListener("auth-error", onAuthError);
    return () => window.removeEventListener("auth-error", onAuthError);
  }, [logout, showModal]);

  if (loading) {
    return (
      <>
        <QASidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <button
          className="fixed bottom-4 left-4 z-50 p-3 bg-merqado-blue rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(true)}
        >
          <BookOpen className="w-6 h-6 text-white" />
        </button>
        <NotificationModal {...modalState} />
        <div className="h-screen w-screen flex items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  const SidebarWrapper = ({ children }) => (
    <>
      <QASidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <button
        className="fixed bottom-4 left-4 z-50 p-3 bg-merqado-blue rounded-full shadow-lg"
        onClick={() => setIsSidebarOpen(true)}
      >
        <BookOpen className="w-6 h-6 text-white" />
      </button>
      <NotificationModal {...modalState} />
      {children}
    </>
  );

  if (isAuthenticated) {
    return (
      <SidebarWrapper>
        <Dashboard />
      </SidebarWrapper>
    );
  }

  const renderAuthPage = () => {
    switch (page) {
      case "forgotPassword":
        return <ForgotPasswordPage setPage={setPage} />;
      case "resetPassword":
        return <ResetPasswordPage setPage={setPage} />;
      case "login":
      default:
        return <LoginPage setPage={setPage} />;
    }
  };

  return <SidebarWrapper>{renderAuthPage()}</SidebarWrapper>;
};

const Dashboard = () => {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState("home");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const handleSearch = async (term) => {
    if (!term) return;
    setIsSearching(true);
    setPage("search");
    setCurrentSearchTerm(term);
    try {
      const query = `
        query SearchProducts($search: String) {
          products(search: $search) {
            products {
              id
              name
              description
              price
              discount_price
              imageUrl
              is_new
              category {
                name
              }
            }
          }
        }
      `;
      const data = await graphqlClient(query, { search: term });
      setSearchResults(data.products.products || []);
    } catch (error) {
      console.error("Search failed", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setSearchTerm("");
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId);
    setPage("productDetail");
  };

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setPage("categoryProducts");
  };

  const renderPage = () => {
    switch (page) {
      case "home":
        return (
          <HomePage
            onProductSelect={handleSelectProduct}
            onCategorySelect={handleSelectCategory}
            setPage={setPage}
          />
        );
      case "search":
        return (
          <SearchPage
            searchTerm={currentSearchTerm}
            results={searchResults}
            loading={isSearching}
            onProductSelect={handleSelectProduct}
          />
        );
      case "categories":
        return <CategoriesPage onCategorySelect={handleSelectCategory} />;
      case "categoryProducts":
        return (
          <CategoryProductsPage
            categoryId={selectedCategoryId}
            onProductSelect={handleSelectProduct}
          />
        );
      case "favorites":
        return <FavoritesPage onProductSelect={handleSelectProduct} />;
      case "cart":
        return <CartPage setPage={setPage} />;
      case "orders":
        return <OrdersPage />;
      case "profile":
        return <ProfilePage />;
      case "checkout":
        return <CheckoutPage setPage={setPage} />;
      case "success":
        return <SuccessPage setPage={setPage} />;
      case "admin":
        return <AdminPage />;
      case "productDetail":
        return (
          <ProductDetailPage productId={selectedProductId} setPage={setPage} />
        );
      case "offers":
        return <OffersPage onProductSelect={handleSelectProduct} />;
      default:
        return (
          <HomePage
            onProductSelect={handleSelectProduct}
            onCategorySelect={handleSelectCategory}
            setPage={setPage}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        setPage={setPage}
        handleSearch={handleSearch}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />
      <SalesToast onProductSelect={handleSelectProduct} />
      <main className="flex-grow">{renderPage()}</main>
      <Footer />
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <NotificationProvider>
      <FavoritesProvider>
        <CartProvider>
          <ToastProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                className: "",
                style: {
                  background: "rgba(247, 246, 246, 0.92)",
                  border: "1px solid rgba(109, 109, 109, 0.14)",
                  color: "#333333",
                  padding: "16px",
                  borderRadius: "12px",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
                },
              }}
            />
            <AppContent />
          </ToastProvider>
        </CartProvider>
      </FavoritesProvider>
    </NotificationProvider>
  </AuthProvider>
);

export default App;
