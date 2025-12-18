"use client";

import { useState, useEffect } from "react";
import { Box, CssBaseline } from "@mui/material";
import Grid from "@mui/material/Grid";

import { useSidebar } from "@/context/SidebarContext";

import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import ReactMarkdown from "react-markdown";
import { renderAsync } from "docx-preview";
import DocumentList from "@/components/File/DocumentList";
import NoteList from "@/components/File/NoteList";
import { useFileStore } from "@/stores/fileStore";
import { useUserStore } from "@/stores/userStore";

const MENU_ICON_URL = "/assets/starfish.png";
const MAIN_BG_URL = "/assets/files4.png";

const fileMetadataCache = {
  notes: null as any[] | null,
  documents: null as any[] | null,
};

function MarkdownPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState("");

  useEffect(() => {
    blob.text().then(setText);
  }, [blob]);

  return (
    <div
      style={{
        height: "80vh",
        overflowY: "auto",
        padding: "16px",
        background: "white",
        borderRadius: "8px",
      }}
    >
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

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
function Files() {
  const { toggleSidebar } = useSidebar();

  const { reloadFlag, shouldReload, clearReloadFlag } = useFileStore();

  const { user_id } = useUserStore();
  const [isOpening, setIsOpening] = useState(false);

  // const handleOpen = async (file: any) => {
  //   setSelectedFile(file);

  //   const res = await fetch(`/api/files/${file.id}`);
  //   const blob = await res.blob();

  //   setFileBlob(blob);
  //   setOpenDialog(true);
  // };
  const handleOpen = async (file: any) => {
    try {
      setIsOpening(true);

      // LINK
      if (file.file_name?.endsWith(".json")) {
        const sourceId = file.file_name.replace(".json", "");
        let data = sourceCache[sourceId];

        if (!data) {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/sources/${sourceId}`
          );
          data = await res.json();

          setSourceCache((prev) => ({
            ...prev,
            [sourceId]: data,
          }));
        }

        setSelectedFile({
          ...file,
          title: data.title,
          content: data.full_text,
          url: data.asset?.url,
          type: "link",
        });

        setOpenDialog(true);
        return;
      }

      // TEXT
      if (file.file_name?.endsWith(".txt")) {
        setSelectedFile({ ...file, type: "text" });
        const res = await fetch(normalizePreviewUrl(file.preview_url));
        const blob = await res.blob();
        setFileBlob(blob);
        setOpenDialog(true);
        return;
      }

      // FILE
      setSelectedFile(file);
      const res = await fetch(normalizePreviewUrl(file.preview_url));
      const blob = await res.blob();
      setFileBlob(blob);
      setOpenDialog(true);
    } finally {
      setIsOpening(false);
    }
  };

  const handleClose = () => {
    setOpenDialog(false);
    setFileBlob(null);
    setSelectedFile(null);
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const [sourceCache, setSourceCache] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!openDialog || !fileBlob) return;
    if (!selectedFile?.file_name?.endsWith(".docx")) return;

    const renderDoc = async () => {
      await new Promise((r) => setTimeout(r, 20)); // chờ dialog render container

      const container = document.getElementById("docx-container");
      if (!container) return;

      container.innerHTML = "";

      const buf = await fileBlob.arrayBuffer();
      renderAsync(buf, container);
    };

    renderDoc();
  }, [openDialog]);

  useEffect(() => {
    if (!user_id) return;
    const fetchFiles = async () => {
      try {
        //Reset cache
        if (shouldReload) {
          fileMetadataCache.notes = null;
          fileMetadataCache.documents = null;
          clearReloadFlag();
        }

        //lay data từ cached
        if (fileMetadataCache.notes && fileMetadataCache.documents) {
          setNotes(fileMetadataCache.notes);
          setDocuments(fileMetadataCache.documents);
          return;
        }

        // Lấy Note và Document
        const [noteRes, docRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API}/files/metadata/note?user_id=${user_id}`
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API}/files/metadata/document?user_id=${user_id}`
          ),
        ]);

        console.log("Fetching notes and documents metadata");
        console.log(
          `${process.env.NEXT_PUBLIC_API}/files/metadata/note?user_id=${user_id}`
        );
        console.log(
          `${process.env.NEXT_PUBLIC_API}/files/metadata/document?user_id=${user_id}`
        );

        const [noteData, docData] = await Promise.all([
          noteRes.json(),
          docRes.json(),
        ]);

        // Cache lại
        fileMetadataCache.notes = noteData.files;
        fileMetadataCache.documents = docData.files;

        // Cập nhật state
        setNotes(noteData.files);
        setDocuments(docData.files);
      } catch (err) {
        console.error("Failed to fetch files metadata", err);
      }
    };

    fetchFiles();
  }, [user_id, reloadFlag]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url(${MAIN_BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <CssBaseline />

      {/* Button mở sidebar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start", // không muốn ở giữa màn hình
          width: "100%",
        }}
      >
        <Box
          onClick={toggleSidebar}
          sx={{
            position: "absolute",
            top: 30,
            left: 30,
            width: 40,
            height: 40,
            cursor: "pointer",
            zIndex: 1301,
            backgroundImage: `url(${MENU_ICON_URL})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backdropFilter: "blur(5px)",
            borderRadius: "50%",
            boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            transition: "transform 0.2s",
            "&:hover": { transform: "scale(1.1)" },
          }}
        />

        {/* <Sidebar open={isSidebarOpen} onClose={toggleSidebar} current="Files" /> */}

        {/* Khu vực hiển thị file */}
        <Box
          sx={{
            padding: 4,
            color: "black",
            width: "80vw",
          }}
        >
          {/* Notes */}
          <Box
            sx={{
              marginBottom: 4,
              paddingRight: "4px",
            }}
          >
            <Box
              sx={{
                fontSize: "1.6rem",
                fontWeight: 700,
                marginBottom: 2,
                borderLeft: "5px solid #4A148C",
                padding: "0 10px",
                textShadow: "0 1px 1px rgba(255,255,255,0.4)",

                // 🔥 Background chỉ dài bằng chữ
                display: "inline-block",

                // ✨ Hiệu ứng glass mờ nhẹ
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",

                borderRadius: "8px",
              }}
            >
              Notes
            </Box>

            <Box
              sx={{
                maxHeight: "35vh",
                overflowY: "auto",
                paddingRight: "6px",

                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "rgba(0,0,0,0.8)",
                },
              }}
            >
              <Grid container spacing={2}>
                {notes.map((note) => (
                  <NoteList note={note} handleOpen={handleOpen} />
                ))}
              </Grid>
            </Box>
          </Box>

          {/* Documents */}
          <Box
            sx={{
              paddingRight: "4px",
            }}
          >
            <Box
              sx={{
                color: "black",
                fontSize: "1.6rem",
                fontWeight: 700,
                marginBottom: 2,
                borderLeft: "5px solid #1B5E20",
                padding: "0 10px",
                textShadow: "0 1px 1px rgba(255,255,255,0.4)",

                // // 🔥 Background chỉ dài bằng chữ
                display: "inline-block",

                // // ✨ Hiệu ứng glass mờ nhẹ
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",

                borderRadius: "8px",
              }}
            >
              Documents
            </Box>

            <Box
              sx={{
                maxHeight: "70vh",
                overflowY: "auto",
                overflowX: "hidden",
                paddingRight: "5px",

                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "rgba(0,0,0,0.8)",
                },
              }}
            >
              <Grid container spacing={2}>
                {documents.map((doc) => (
                  <DocumentList
                    doc={doc}
                    handleOpen={handleOpen}
                    sourceCache={sourceCache}
                    setSourceCache={setSourceCache}
                  />
                ))}
              </Grid>
            </Box>
          </Box>
        </Box>
      </Box>

      {isOpening && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(6px)",
            color: "white",
            fontSize: "1.2rem",
            fontWeight: 600,
          }}
        >
          Loading content...
        </Box>
      )}

      <Dialog open={openDialog} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedFile?.title || selectedFile?.file_name}
        </DialogTitle>

        <DialogContent
          sx={{
            overflowY: "hidden", // ✨ chặn scroll dọc
            padding: 0, // (optional) bỏ padding để iframe/docx fullscreen đẹp hơn
          }}
        >
          {/* Markdown */}
          {/* {selectedFile?.content && fileBlob && (
            <MarkdownPreview blob={fileBlob} />
          )} */}

          {/* PDF */}
          {/* {String(selectedFile?.file_name || "")
            .toLowerCase()
            .endsWith(".pdf") &&
            fileBlob && (
              <iframe
                src={URL.createObjectURL(fileBlob)}
                style={{ width: "100%", height: "80vh", border: "none" }}
              />
            )} */}

          {/* DOCX */}
          {/* {String(selectedFile?.file_name || "")
            .toLowerCase()
            .endsWith(".docx") &&
            fileBlob && (
              <div
                id="docx-container"
                style={{ height: "80vh", overflow: "auto" }}
              />
            )} */}
          {selectedFile?.type === "link" && (
            <Box
              sx={{
                height: "80vh",
                overflowY: "auto",
                padding: 2,
                background: "white",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedFile.content || "Processing..."}
            </Box>
          )}

          {selectedFile?.type === "text" && fileBlob && (
            <Box
              sx={{
                height: "80vh",
                overflowY: "auto",
                padding: 2,
                background: "white",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
              }}
            >
              <MarkdownPreview blob={fileBlob} />
            </Box>
          )}

          {/* MARKDOWN FILE */}
          {selectedFile?.file_name?.endsWith(".md") && fileBlob && (
            <MarkdownPreview blob={fileBlob} />
          )}

          {/* PDF */}
          {selectedFile?.file_name?.endsWith(".pdf") && fileBlob && (
            <iframe
              src={URL.createObjectURL(fileBlob)}
              style={{ width: "100%", height: "80vh", border: "none" }}
            />
          )}

          {/* DOCX */}
          {selectedFile?.file_name?.endsWith(".docx") && fileBlob && (
            <div
              id="docx-container"
              style={{ height: "80vh", overflow: "auto" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Files;
