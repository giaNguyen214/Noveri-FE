"use client";

import React, { useEffect, useState } from "react";
import { Box, CssBaseline, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Sidebar from "@/components/Editor/Sidebar";
import Toolbar from "@/components/Editor/Toolbar";
import TextEditor from "@/components/Editor/TextEditor/TextEditor";
import { useSidebar } from "@/context/SidebarContext";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { useUserStore } from "@/stores/userStore";
// URL của ảnh nền chính (giả sử đặt trong /public)
const MAIN_BG_URL = "/assets/sea9.png";
const MENU_ICON_URL = "/assets/starfish.png";

function normalizePreviewUrl(previewUrl: string) {
  const apiBase = process.env.NEXT_PUBLIC_API;
  if (!apiBase) return previewUrl;

  try {
    const u = new URL(previewUrl);
    const api = new URL(apiBase);

    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      u.protocol = api.protocol;
      u.hostname = api.hostname; // chỉ hostname
      u.port = ""; // xoá port
      return u.toString();
    }

    return previewUrl;
  } catch {
    if (previewUrl.startsWith("/")) {
      return `${apiBase}${previewUrl}`;
    }
    return previewUrl;
  }
}

function App() {
  const { toggleSidebar } = useSidebar();

  const { user_id } = useUserStore();

  const params = useParams();
  // ensure etag is a single string (useParams may return string | string[] | undefined)
  const etagParam = (params as any)?.etag;
  const etag = Array.isArray(etagParam) ? etagParam[0] : etagParam;
  const [content, setContent] = useState("");
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const metadataRes = await fetch(
          `${process.env.NEXT_PUBLIC_API}/files/metadata/note/${etag}?user_id=${user_id}`
        );

        const metadataUrl = `${process.env.NEXT_PUBLIC_API}/files/metadata/note/${etag}?user_id=${user_id}`;
        console.log("Fetching metadata from:");
        console.log(metadataUrl);

        const metadataData = await metadataRes.json();

        const fixedPreviewUrl = normalizePreviewUrl(metadataData.preview_url);
        console.log("Fixed Preview URL:", fixedPreviewUrl);

        const contentRes = await fetch(fixedPreviewUrl);
        const contentText = await contentRes.text();

        setMetadata({ ...metadataData, preview_url: fixedPreviewUrl });
        setContent(contentText);
      } catch (e) {
        console.error("Failed to load content or metadata", e);
        toast.error("Failed to load content or metadata");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [etag]);

  if (isLoading || !metadata) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Loading content...
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        backgroundImage: `url(${MAIN_BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Giúp reset CSS và làm nền full màn hình */}
      <CssBaseline />

      <Box
        onClick={toggleSidebar}
        sx={{
          position: "absolute",
          top: 30,
          left: 30,
          width: 40, // Đặt kích thước cố định cho nút ảnh
          height: 40,
          cursor: "pointer", // Biến thành con trỏ để báo hiệu là nút
          zIndex: 1301,

          // Áp dụng ảnh làm nền
          backgroundImage: `url(${MENU_ICON_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",

          // Áp dụng Glassmorphism
          backdropFilter: "blur(5px)",
          borderRadius: "50%",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          transition: "transform 0.2s", // Thêm hiệu ứng chuyển động khi hover

          // Hiệu ứng hover (phóng to nhẹ khi rê chuột)
          "&:hover": {
            transform: "scale(1.1)",
          },

          // Hiển thị gradient/màu khác khi sidebar chưa mở (Không cần nữa vì dùng ảnh)
          // Nếu bạn muốn thay đổi độ mờ của ảnh dựa trên isSidebarOpen, dùng opacity
        }}
      />

      {/* Sidebar (Drawer) */}
      {/* <Sidebar open={isSidebarOpen} onClose={toggleSidebar} /> */}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1, // khoảng cách giữa Toolbar và TextEditor
          width: "100%",
          height: "100vh",
        }}
      >
        <TextEditor content={content} />
        {/* <Toolbar /> */}
      </Box>
    </Box>
  );
}

export default App;
