"use client";

// temp
import { useState, useEffect } from "react";
import { supabase } from "@/components/Utils/SupabaseClient";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import LinkIcon from "@mui/icons-material/Link";
import ArticleIcon from "@mui/icons-material/Article";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"; // Hoặc icon này cho đẹp

// Hàm lấy ID video từ link youtube bất kỳ
const getYoutubeId = (url: any) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Import UI Components
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  IconButton,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemButton,
  Checkbox,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import SmartToyIcon from "@mui/icons-material/SmartToy";

import WarningAmberIcon from "@mui/icons-material/WarningAmber"; // Conflict
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh"; // Improvement
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt"; // Hallucination
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  MenuOpen as MenuOpenIcon,
  Save as SaveIcon,
  Source as SourceIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify"; // Import toastify
// --- 1. Types definitions based on New JSON ---

import { SourceItem, SimpleSource, NoteItem } from "@/type/source/Source";

interface ConflictItem {
  new_note_sentence: string;
  evidence_from_sources: string[];
  reason: string;
  suggested_rewrite: string;
}

interface ImprovementItem {
  new_note_sentence: string;
  missing_context: string;
  suggested_addition: string;
}

interface HallucinationItem {
  new_note_sentence: string;
  reason: string;
  suggested_rewrite: string;
}

interface AIResponse {
  conflicts: ConflictItem[];
  improvements: ImprovementItem[];
  hallucinations: HallucinationItem[];
  summary: string;
}

// --- 2. Unified Type for Rendering (Normalized) ---
// Để dễ map trong JSX, ta gộp 3 loại trên về 1 chuẩn chung
interface UnifiedResultItem {
  id: string;
  type: "conflict" | "improvement" | "hallucination";

  // Row 1 Data
  displayMessage: string; // Message ngắn gọn

  // Row 2 Data
  sentence: string; // new_note_sentence

  // Row 3 Data
  reason: string; // reason HOẶC missing_context

  // Row 4 Data
  suggestion: string; // suggested_rewrite HOẶC suggested_addition

  // Expandable Data
  sources?: string[]; // evidence_from_sources (chỉ conflict mới có trong mẫu)

  expanded: boolean; // State UI
}

import "@mdxeditor/editor/style.css";
import "./editorStyles.css";

import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  Separator,
} from "@mdxeditor/editor";
import { initialMarkdown } from "./initialMarkdown";
import { useFileStore } from "@/stores/fileStore";
import { useUserStore } from "@/stores/userStore";

function getChatSessionByUrl() {
  if (typeof window === "undefined") return null;

  const urlId = window.location.pathname.split("/").pop();

  if (urlId === "67fdb5f7a429e9c91a8eb8b68a4f64d5") {
    return "chat_session:3h3k3jftuc2rbypfz848";
  }

  return "chat_session:9cikcp23p2itm1npo4jq";
}

export async function saveToSupabase(user_id: string, session_id: string) {
  const { data, error } = await supabase
    .from("history_result") // ← đổi tên theo bảng thật của bạn
    .insert([
      {
        user_id,
        session_id,
      },
    ]);

  if (error) {
    console.error("❌ Supabase Insert Error:", error);
    throw error;
  }

  console.log("✅ Insert success:", data);
  return data;
}

const TextEditor = ({ content }: any) => {
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  useEffect(() => {
    fetch("/prompts/factual_check.txt")
      .then((r) => r.text())
      .then(setSystemPrompt)
      .catch(console.error);
  }, []);

  const [markdown, setMarkdown] = useState(content || initialMarkdown);

  const [showSidebar, setShowSidebar] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");

  const { triggerReloadNote } = useFileStore();

  const { user_id } = useUserStore();

  const handleEditorChange = (newMarkdown: string) => {
    setMarkdown(newMarkdown);
  };

  const [results, setResults] = useState<UnifiedResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [allSources, setAllSources] = useState<SimpleSource[]>([]);

  const [isLoadingSources, setLoadingSources] = useState(false);
  const [isLoadingHistory, setLoadingHistory] = useState(false);

  // State chứa danh sách relations
  const [relations, setRelations] = useState<any[]>([]); // Mặc định là mảng rỗng
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const [notebookId, setNotebookId] = useState<string | null>(null);
  useEffect(() => {
    const id = localStorage.getItem("notebook_id");
    setNotebookId(id);
  }, []);

  const getSourcesListAndString = async () => {
    const url = `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/sources`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!Array.isArray(data)) return { list: [], text: "" };

      // <=10 lấy hết, >10 random 10
      let selected: any = [];
      if (data.length <= 10) {
        selected = data;
      } else {
        const arr = [...data];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        selected = arr.slice(0, 10);
      }

      // =========== TẠO LIST RÚT GỌN ===========
      const list: any = [];

      for (const item of selected) {
        const insightsUrl = `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/sources/${item.id}/insights`;

        let insightContent: any = null;

        try {
          const insRes = await fetch(insightsUrl);
          const insData = await insRes.json();

          if (Array.isArray(insData) && insData.length > 0) {
            insightContent = insData[0].content ?? null;
          }
        } catch (e) {
          insightContent = null;
        }

        // ========== RULE file_path chính xác ==========
        let file_path: any = "";

        const assetUrl: any = item?.asset?.url ?? "";
        const assetFile: any = item?.asset?.file_path ?? "";

        // youtube
        if (
          assetUrl.toLowerCase().includes("youtube.com") ||
          assetUrl.toLowerCase().includes("youtu.be") ||
          assetUrl.toLowerCase().includes("youtube")
        ) {
          file_path = assetUrl;
        }
        // link https
        else if (assetUrl.startsWith("http")) {
          file_path = assetUrl;
        }
        // file upload PDF / DOCX
        else if (assetFile) {
          file_path = assetFile;
        }

        // Push item rút gọn vào danh sách
        list.push({
          id: item.id ?? "",
          title: item.title ?? "",
          file_path,
          insight_content: insightContent ?? "",
        });
      }

      // =========== CHUYỂN LIST → STRING ===========
      const text = list
        .map(
          (item: any) =>
            `ID: ${item.id}\nTitle: ${item.title}\nFile: ${item.file_path}\nInsight: ${item.insight_content}\n---`
        )
        .join("\n");

      return { list, text };
    } catch (err) {
      console.error("Lỗi:", err);
      return { list: [], text: "" };
    }
  };

  const handleFetchRelated = async () => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : "";

    if (!selectedText || selectedText.trim() === "") {
      // alert("Please select some text first!");
      toast.error("Please select some text first!", {
        position: "top-right",
      });

      return;
    }
    setIsLoadingRelated(true);

    const { list, text } = await getSourcesListAndString();

    console.log(list); // danh sách { id, title, file_path, insight_content }
    // console.log(text); // chuỗi gộp

    const res = await fetch("/api/clova", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list, text, selectedText }),
    });

    const result = await res.json();

    const raw = result.result?.message?.content || "";
    const cleaned = raw.replace(/[\[\]\s]/g, "");
    const idList = cleaned.split(",").filter(Boolean);

    console.log(result);
    const relations: any = idList.map((id: any) => {
      const found: any = list.find((item: any) => item.id.includes(id));

      if (!found) {
        return {
          type: "source",
          title: "Không tìm thấy tài liệu",
          summary: "",
          content: id,
        };
      }

      let type: any = "source";
      let content: any = found.id; // default cho source

      const url: any = found.final_url; // giữ nguyên URL

      if (url) {
        const lower: any = url.toLowerCase();

        // Youtube check trước (vì youtube cũng là https)
        if (
          lower.includes("youtube.com") ||
          lower.includes("youtu.be") ||
          lower.includes("youtube")
        ) {
          type = "youtube";
          content = url; // GIỮ NGUYÊN URL
        }
        // Link bình thường (https và KHÔNG phải youtube)
        else if (lower.startsWith("https")) {
          type = "link";
          content = url; // GIỮ NGUYÊN URL
        }
      }

      return {
        type,
        title: found.title,
        summary:
          (found.insight_content?.slice(0, 90) as any) +
          ((found.insight_content?.length as any) > 90 ? "..." : ""),
        content,
      };
    });

    // 3. Set vào state
    setRelations(relations);
    setIsLoadingRelated(false);
  };

  useEffect(() => {
    // Chỉ fetch khi menu được mở
    if (!showSourceMenu) return;
    setLoadingSources(true);

    const fetchData = async () => {
      try {
        const [sourcesRes, notesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/sources`),
          fetch(`${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/notes`),
        ]);

        const sourcesData: SourceItem[] = await sourcesRes.json();
        const notesData: NoteItem[] = await notesRes.json();

        // Map sources -> SimpleSource
        const mappedSources: SimpleSource[] = sourcesData.map((item) => ({
          id: item.id,
          name: item.title,
        }));

        // Map notes -> SimpleSource (fallback nếu title null)
        const mappedNotes: SimpleSource[] = notesData.map((note) => ({
          id: note.id,
          name: note.title ?? note.content.substring(0, 30) + "...",
        }));

        setAllSources([...mappedSources, ...mappedNotes]);
      } catch (error) {
        console.error("Error fetching sources/notes:", error);
      } finally {
        setLoadingSources(false);
      }
    };

    fetchData();
  }, [showSourceMenu]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSource = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredSources = allSources.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mock data lịch sử cũ (hoặc gọi API lấy history tại đây)
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);

      try {
        const sessionId = getChatSessionByUrl();

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/chat/sessions/${sessionId}`
        );

        const data = await response.json();

        // Tìm message type "ai"
        const aiMessage = data.messages.find((msg: any) => msg.type === "ai");

        if (!aiMessage) {
          console.warn("Không tìm thấy message AI");
          setLoadingHistory(false);
          return;
        }

        // Parse JSON từ AI
        // const parsed = safeJsonParse(aiMessage.content);
        const parsed = robustJsonParse(aiMessage.content);

        console.log("PARSED AI JSON:", parsed);

        // ---- TRANSFORM TO UnifiedResultItem[] ----
        const newItems: UnifiedResultItem[] = [];

        // 1. Conflicts
        parsed.conflicts?.forEach((item: any) => {
          newItems.push({
            id: crypto.randomUUID(),
            type: "conflict",
            displayMessage: "Detected Contradiction",
            sentence: item.new_note_sentence,
            reason: item.reason,
            suggestion: item.suggested_rewrite,
            sources: item.evidence_from_sources ?? [],
            expanded: false,
          });
        });

        // 2. Improvements
        parsed.improvements?.forEach((item: any) => {
          newItems.push({
            id: crypto.randomUUID(),
            type: "improvement",
            displayMessage: "Context Suggestion",
            sentence: item.new_note_sentence,
            reason: item.missing_context,
            suggestion: item.suggested_addition,
            sources: [],
            expanded: false,
          });
        });

        // 3. Hallucinations
        parsed.hallucinations?.forEach((item: any) => {
          newItems.push({
            id: crypto.randomUUID(),
            type: "hallucination",
            displayMessage: "Unverified Info",
            sentence: item.new_note_sentence,
            reason: item.reason,
            suggestion: item.suggested_rewrite,
            sources: [],
            expanded: false,
          });
        });

        // Set kết quả vào UI
        setResults(newItems);
      } catch (error) {
        console.error("Lỗi fetch history:", error);
      }

      setLoadingHistory(false);
    };

    fetchHistory();
  }, []);

  const createNewChatSession = async (): Promise<string> => {
    const DEFAULT_SESSION = "chat_session:2ggjs302tkgpeuzpurod";

    try {
      // 1. Two notebook IDs
      const notebooks = [
        "notebook:j75mhkcvh5544g9pb7w1", // Notebook 4
        "notebook:ppyrds4wad0ph0k4nvy7", // Notebook 5
      ];

      // 2. Random pick
      const randomIndex = Math.floor(Math.random() * notebooks.length);
      const notebookId = notebooks[randomIndex];

      // 3. Notebook number for title
      const notebookNumber = randomIndex + 1;
      const title = `Notebook ${notebookNumber} - Main screen verify`;

      // 4. Payload
      const payload = {
        notebook_id: notebookId,
        title,
      };

      // 5. POST request
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/chat/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (data?.id) {
        return data.id; // → success
      }

      // If API responds without id
      return DEFAULT_SESSION;
    } catch (err) {
      console.error("Error creating chat session:", err);
      return DEFAULT_SESSION; // fallback
    }
  };

  // function safeJsonParse(jsonString: string): any {
  //   try {
  //     return JSON.parse(jsonString);
  //   } catch (err1) {
  //     console.warn("JSON failed, applying auto-fix...");

  //     // 1. Replace smart quotes
  //     let fixed = jsonString.replace(/[“”]/g, '"');

  //     // 2. Escape ALL naked quotes inside values
  //     fixed = fixed.replace(/"(.*?[^\\])"(?!\s*[:,}\]])/g, (match) => {
  //       // convert "abc" → \"abc\"
  //       return match.replace(/"/g, '\\"');
  //     });

  //     // 3. Attempt second parse
  //     try {
  //       return JSON.parse(fixed);
  //     } catch (err2) {
  //       console.error("Auto-fix JSON failed:", err2);
  //       console.log("BROKEN JSON:", jsonString);
  //       console.log("FIXED JSON:", fixed);

  //       // Fallback
  //       return {
  //         conflicts: [],
  //         improvements: [],
  //         hallucinations: [],
  //         summary: "",
  //       };
  //     }
  //   }
  // }

  function robustJsonParse(input: string) {
    const fallback = {
      conflicts: [],
      improvements: [],
      hallucinations: [],
      summary: "",
    };
    try {
      return JSON.parse(input);
    } catch {}

    console.warn("JSON failed, applying auto-fix...");
    console.log("BROKEN JSON:", input);

    let s = String(input || "").trim();

    // drop markdown fences anywhere
    s = s
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();

    // if HTML/error page
    if (/^\s*<(?:!doctype|html)\b/i.test(s)) {
      console.log("FIXED JSON:", s);
      return fallback;
    }

    // keep only the first balanced {...} (works even if extra junk after)
    const start = s.indexOf("{");
    if (start >= 0) {
      let depth = 0,
        inStr = false,
        esc = false,
        end = -1;
      for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === "{") depth++;
          else if (c === "}") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
      }
      if (end > start) s = s.slice(start, end + 1).trim();
    }

    // fix the exact Gemini artifact: \"key\": and : \"value\"
    s = s.replace(/\\"([^"\\]+)\\"\s*:/g, '"$1":');
    s = s.replace(
      /:\s*\\"([\s\S]*?)\\"(?=\s*[,\}])/g,
      (_m, g1) => ': "' + String(g1).replace(/\\"/g, '"') + '"'
    );
    s = s.replace(/[“”]/g, '"');

    console.log("FIXED JSON:", s);

    try {
      const obj = JSON.parse(s);
      const parsed = {
        conflicts: Array.isArray(obj?.conflicts) ? obj.conflicts : [],
        improvements: Array.isArray(obj?.improvements) ? obj.improvements : [],
        hallucinations: Array.isArray(obj?.hallucinations)
          ? obj.hallucinations
          : [],
        summary: typeof obj?.summary === "string" ? obj.summary : "",
      };
      console.log("PARSED AI JSON:", parsed);
      return parsed;
    } catch (err) {
      console.error("Auto-fix JSON failed:", err);
      return fallback;
    }
  }

  const chatWithHCX007 = async (
    selectedText: string,
    selectedIds: string[]
  ) => {
    setLoading(true);

    try {
      // --- 1. SPLIT IDs into sources[] & notes[] ---
      const sourceIds = selectedIds
        .filter((id) => id.startsWith("source:"))
        .map((id) => ({ id }));

      const noteIds = selectedIds
        .filter((id) => id.startsWith("note:"))
        .map((id) => ({ id }));

      const newSessionId = await createNewChatSession();

      // --- 2. PAYLOAD ---
      const fullMessage = `
        [SYSTEM INSTRUCTION - MUST FOLLOW EXACTLY]
        ${systemPrompt}

        ---
        [USER INPUT - ANALYZE ONLY THIS]
        ${selectedText}
        `;

      const payload = {
        session_id: newSessionId,
        message: fullMessage,
        context: {
          sources: sourceIds,
          notes: noteIds,
        },
        model_override: "model:kv3pmgczupuc15whfoe8",
      };

      // console.log("session id", createNewChatSession());
      console.log("JSON payload", JSON.stringify(payload));
      // --- 3. CALL API ---
      // const res = await fetch(
      //   `${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/chat/execute`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify(payload),
      //   }
      // );

      const res = await fetch("/api/chat/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      console.log("RAW API RESPONSE:", data);

      // --- 4. Extract AI response JSON from messages ---
      const aiMessage = data.messages?.find((m: any) => m.type === "ai");

      if (!aiMessage) {
        console.error("No AI message found in response.");
        toast.error(
          "API AI đã hết quota. Vui lòng thử lại sau hoặc đổi model.",
          { position: "top-right" }
        );

        setLoading(false);
        return;
      }

      // AI trả JSON dưới dạng string → parse lại
      // const parsed = safeJsonParse(aiMessage.content);
      const parsed = robustJsonParse(aiMessage.content);

      console.log("PARSED AI JSON:", parsed);

      // --- 5. TRANSFORM TO UnifiedResultItem[] ---
      const newItems: UnifiedResultItem[] = [];

      // 5.1 Conflicts
      parsed.conflicts?.forEach((item: any) => {
        newItems.push({
          id: crypto.randomUUID(),
          type: "conflict",
          displayMessage: "Detected Contradiction",
          sentence: item.new_note_sentence,
          reason: item.reason,
          suggestion: item.suggested_rewrite,
          sources: item.evidence_from_sources ?? [],
          expanded: false,
        });
      });

      // 5.2 Improvements
      parsed.improvements?.forEach((item: any) => {
        newItems.push({
          id: crypto.randomUUID(),
          type: "improvement",
          displayMessage: "Context Suggestion",
          sentence: item.new_note_sentence,
          reason: item.missing_context,
          suggestion: item.suggested_addition,
          sources: [],
          expanded: false,
        });
      });

      // 5.3 Hallucinations
      parsed.hallucinations?.forEach((item: any) => {
        newItems.push({
          id: crypto.randomUUID(),
          type: "hallucination",
          displayMessage: "Unverified Info",
          sentence: item.new_note_sentence,
          reason: item.reason,
          suggestion: item.suggested_rewrite,
          sources: [],
          expanded: false,
        });
      });

      // --- 6. UPDATE UI ---
      setResults((prev) => [...newItems, ...prev]);

      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        console.error("No user_id found in localStorage");
        return;
      }

      saveToSupabase(user_id, newSessionId);
    } catch (error) {
      console.error("Error calling API:", error);
      toast.error("API AI đã hết quota. Vui lòng thử lại sau hoặc đổi model.", {
        position: "top-right",
      });
    }

    setLoading(false);
  };

  // Helper toggle expand
  const toggleExpand = (id: string) => {
    setResults((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  // --- LOGIC 2: Xử lý nút "Check Selection" ---
  const handleCheckSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : "";

    if (!selectedText || selectedText.trim() === "") {
      // alert("Please select some text first!");
      toast.error("Please select some text first!", {
        position: "top-right",
      });

      return;
    }

    if (selectedIds.length === 0) {
      // alert("Please select some sources!");
      toast.error("Please select some sources!", {
        position: "top-right",
      });

      return;
    }

    // console.log("selectedText", selectedText);
    // console.log("selectedIds", selectedIds);
    chatWithHCX007(selectedText, selectedIds);
  };

  // Hàm xóa card
  const handleDelete = async (idString: string) => {
    // Mock API Call
    // await api.deleteItem(idString);
    console.log("Deleted item:", idString);

    // Cập nhật State (Số thứ tự sẽ tự động tính lại khi render)
    setResults((prev) => prev.filter((item) => item.id !== idString));
  };

  // Helper lấy màu và icon dựa trên type
  const getTypeConfig = (type: UnifiedResultItem["type"]) => {
    switch (type) {
      case "conflict":
        return {
          color: "#ff5050", // Đỏ
          bg: "rgba(255, 80, 80, 0.1)",
          border: "rgba(255, 80, 80, 0.3)",
          icon: <WarningAmberIcon sx={{ color: "#ff5050", fontSize: 20 }} />,
        };
      case "hallucination":
        return {
          color: "#ffa726", // Cam
          bg: "rgba(255, 167, 38, 0.1)",
          border: "rgba(255, 167, 38, 0.3)",
          icon: <PsychologyAltIcon sx={{ color: "#ffa726", fontSize: 20 }} />,
        };
      case "improvement":
        return {
          color: "#29b6f6", // Xanh dương sáng
          bg: "rgba(41, 182, 246, 0.1)",
          border: "rgba(41, 182, 246, 0.3)",
          icon: <AutoFixHighIcon sx={{ color: "#29b6f6", fontSize: 20 }} />,
        };
    }
  };

  const handleSave = async () => {
    if (!noteTitle.trim()) {
      toast.error("Please enter a title!");
      return;
    }

    setIsSaving(true);

    try {
      // ---- 1. Chuẩn bị file markdown để upload MinIO ----
      const blob = new Blob([markdown], { type: "text/markdown" });
      const file = new File([blob], `${noteTitle}.md`, {
        type: "text/markdown",
      });

      const formData = new FormData();
      formData.append("file", file);

      // ---- 2. Tạo body request cho NotebookLM ----
      const notebookPayload = {
        title: noteTitle,
        content: markdown,
        note_type: "human",
        notebook_id: notebookId,
      };

      // ---- 3. Chạy song song 2 API ----
      await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API}/files/upload/note?user_id=${user_id}`,
          {
            method: "POST",
            body: formData,
          }
        ),
        fetch(`${process.env.NEXT_PUBLIC_API_NOTEBOOK}/api/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notebookPayload),
        }),
      ]);

      triggerReloadNote();

      toast.success("Saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Save failed!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      {/* Chips List */}
      <Box
        className="w-full max-w-[70vw] mb-2.5 flex gap-0.5 min-h-8"
        sx={{
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          scrollbarWidth: "thin", // Firefox
          "&::-webkit-scrollbar": {
            height: 6, // thanh scroll nhỏ
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent", // trong suốt
          },
          "&::-webkit-scrollbar-thumb": {
            background: "transparent",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(0,0,0,0.8)",
          },
          scrollbarColor: "rgba(0,0,0,0.5) transparent",
        }}
      >
        {selectedIds.map((id) => {
          const file = allSources.find((s) => s.id === id);
          return file ? (
            <Chip
              key={id}
              label={file.name}
              size="small"
              onDelete={() => handleToggleSource(id)}
              sx={{
                backdropFilter: "blur(4px)",
                background: "rgba(255, 255, 255, 0.7)",
                "& .MuiChip-deleteIcon:hover": { color: "error.main" },
                display: "inline-flex",
              }}
            />
          ) : null;
        })}
      </Box>

      <Box
        sx={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.5), rgba(255,255,255,0.3))",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",

          width: { xs: "80vw", md: "85vw" },
          height: "90vh",
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: "20%", // Bạn có thể chỉnh độ rộng tùy ý (ví dụ 250px hoặc 15%)
            height: "90%",
            borderRight: "1px solid rgba(255, 255, 255, 0.25)", // Viền ngăn cách
            display: "flex",
            flexDirection: "column",
            p: 2,
            overflowY: "auto",

            marginX: "15px",
            marginY: "auto",
            borderRadius: "20px",

            background: "rgba(255, 255, 255, 0.15)",
            WebkitBackdropFilter: "blur(2px)",
            border: showSidebar ? "1px solid rgba(255,255,255,0.22)" : "none",
            boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
              pb: 1,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              Related Results
            </Typography>

            {/* Nút bấm kích hoạt Fetch */}
            <IconButton
              size="small"
              onClick={handleFetchRelated}
              disabled={isLoadingRelated}
              sx={{
                color: "rgba(0,0,0,0.7)",
                bgcolor: "rgba(255,255,255,0.2)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.4)" },
              }}
            >
              {isLoadingRelated ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                // Bạn có thể đổi thành <AutoAwesomeIcon /> nếu muốn icon "AI"
                <RefreshIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
          {/* Nội dung Sidebar mới đặt ở đây */}
          {relations.length === 0 && (
            <Box
              sx={{
                textAlign: "center",
                color: "text.secondary",
                fontSize: "14px",
                opacity: 0.6,
                py: 3,
              }}
            >
              Không tìm thấy nội dung liên quan.
            </Box>
          )}
          {/* --- List Relations --- */}
          {relations.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {relations.map((item, index) => {
                // --- RENDER YOUTUBE TYPE ---
                if (item.type === "youtube") {
                  const videoId = getYoutubeId(item.content);
                  const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

                  return (
                    <Box
                      key={index}
                      onClick={() => window.open(item.content, "_blank")} // Bấm vào mở tab mới
                      sx={{
                        cursor: "pointer",
                        borderRadius: "12px",
                        overflow: "hidden",
                        bgcolor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        transition: "all 0.2s",
                        "&:hover": {
                          bgcolor: "rgba(255,255,255,0.1)",
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        },
                      }}
                    >
                      {/* Phần Thumbnail + Nút Play Overlay */}
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          paddingTop: "56.25%" /* Tỷ lệ 16:9 */,
                        }}
                      >
                        <img
                          src={thumbnail}
                          alt={item.title}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {/* Lớp phủ đen mờ */}
                        <Box
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: "rgba(0,0,0,0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* Nút Play Tròn Trắng */}
                          <PlayCircleOutlineIcon
                            sx={{
                              fontSize: 48,
                              color: "rgba(255,255,255,0.9)",
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Phần Title & Summary bên dưới */}
                      <Box sx={{ p: 1.5 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          sx={{
                            lineHeight: 1.2,
                            mb: 0.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.summary}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }

                // --- RENDER LINK TYPE ---
                if (item.type === "link") {
                  return (
                    <Box
                      key={index}
                      onClick={() => window.open(item.content, "_blank")}
                      sx={{
                        cursor: "pointer",
                        p: 1.5,
                        borderRadius: "12px",
                        bgcolor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        gap: 1.5,
                        alignItems: "flex-start",
                        transition: "0.2s",
                        "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                      }}
                    >
                      <Box
                        sx={{
                          p: 0.8,
                          borderRadius: "8px",
                          bgcolor: "rgba(33, 150, 243, 0.1)", // Màu xanh nhạt
                          color: "#2196f3",
                          display: "flex",
                        }}
                      >
                        <LinkIcon fontSize="small" />
                      </Box>
                      <Box sx={{ overflow: "hidden" }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          noWrap
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block" }}
                        >
                          {item.summary}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }

                // --- RENDER SOURCE TYPE ---
                if (item.type === "source") {
                  return (
                    <Box
                      key={index}
                      // onClick={() => handleOpenSource(item.content)} // Logic mở source nội bộ
                      sx={{
                        cursor: "pointer",
                        p: 1.5,
                        borderRadius: "12px",
                        bgcolor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        gap: 1.5,
                        alignItems: "flex-start",
                        transition: "0.2s",
                        "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                      }}
                    >
                      <Box
                        sx={{
                          p: 0.8,
                          borderRadius: "8px",
                          bgcolor: "rgba(76, 175, 80, 0.1)", // Màu xanh lá nhạt
                          color: "#4caf50",
                          display: "flex",
                        }}
                      >
                        <ArticleIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.summary}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }

                return null;
              })}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* --- PHẦN 1: SIDEBAR REVIEW (30%) --- */}
          <Box
            sx={{
              flex: 5,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Nút Manual Check & Toggle Sidebar */}
            <Box
              sx={{
                position: "absolute",
                top: 10,
                right: 15,
                zIndex: 100,
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                gap: 1,
              }}
            >
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={!isSaving && <SaveIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  // backdropFilter: "blur(4px)",
                  borderRadius: "12px",
                  // bgcolor: isSaving ? "rgba(0,0,0)" : "primary.main",
                  color: "white",
                  // boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                  "&:hover": {
                    background: isSaving
                      ? "rgba(0,0,0,0.1)"
                      : "rgba(21, 101, 192, 1)",
                  },
                  ml: "50px",
                  "&.Mui-disabled": {
                    color: "white",
                    opacity: 0.7, // bạn có thể chỉnh mức mờ
                  },
                }}
              >
                {isSaving ? "saving..." : "Save"}
              </Button>

              <TextField
                variant="standard"
                value={noteTitle}
                placeholder="Your note title here"
                onChange={(e) => setNoteTitle(e.target.value)}
                InputProps={{
                  disableUnderline: true, // bỏ underline khi chưa focus
                }}
                sx={{
                  maxWidth: "150px",
                  mt: "5px",
                  "& .MuiInputBase-root": {
                    cursor: "pointer",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                  },
                  "& .MuiInputBase-root:hover": {
                    cursor: "pointer",
                  },
                  "& .MuiInputBase-input": {
                    padding: 0,
                  },
                  "& .MuiInputBase-root.Mui-focused": {
                    cursor: "text",
                    borderBottom: "1px solid", // khi focus mới có gạch
                  },
                }}
              />

              {/* Nút Check Selection cũ giữ nguyên ở đây */}
              <div className="flex gap-3">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setShowSourceMenu(!showSourceMenu)}
                  startIcon={
                    showSourceMenu ? <ExpandLessIcon /> : <ExpandMoreIcon />
                  }
                  sx={{
                    textTransform: "none",
                    fontWeight: "bold",
                    backdropFilter: "blur(4px)",
                    borderRadius: "12px",
                    bgcolor: showSourceMenu
                      ? "rgba(21, 101, 192, 1)"
                      : "primary.main",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                  }}
                >
                  Select sources
                </Button>
                {showSourceMenu && (
                  <Paper
                    sx={{
                      position: "absolute",
                      top: "115%",
                      right: "20%",
                      width: 280,
                      maxHeight: 350,
                      // overflow: "hidden",
                      borderRadius: "12px",
                      zIndex: 999,
                      background: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(10px)",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                    }}
                  >
                    <Box sx={{ p: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </Box>
                    <List
                      sx={{
                        overflowY: "auto",
                        overflowX: "hidden",
                        flex: 1,
                        p: 0,
                        "&::-webkit-scrollbar": {
                          width: "6px",
                        },
                        "&::-webkit-scrollbar-thumb": {
                          background: "rgba(0,0,0,0.5)",
                          borderRadius: "3px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                          background: "rgba(0,0,0,0.8)",
                        },
                        "&::-webkit-scrollbar-track": {
                          background: "transparent",
                        },
                        scrollbarWidth: "thin", // Firefox
                        scrollbarColor: "rgba(0,0,0,0.5) transparent",
                      }}
                    >
                      {isLoadingSources ? (
                        <Box
                          sx={{
                            width: "100%",
                            py: 4,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <CircularProgress size={28} />
                        </Box>
                      ) : (
                        filteredSources.map((s) => (
                          <ListItem key={s.id} disablePadding dense>
                            <ListItemButton
                              onClick={() => handleToggleSource(s.id)}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <Checkbox
                                  edge="start"
                                  checked={selectedIds.includes(s.id)}
                                  size="small"
                                />
                              </ListItemIcon>
                              <ListItemText primary={s.name} />
                            </ListItemButton>
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Paper>
                )}

                {/* Nút Check Selection cũ giữ nguyên ở đây */}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCheckSelection}
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} thickness={5} />
                    ) : (
                      <CheckCircleOutlineIcon />
                    )
                  }
                  sx={{
                    textTransform: "none",
                    fontWeight: "bold",
                    backdropFilter: "blur(4px)",
                    bgcolor: loading ? "grey.500" : "primary.main",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                    borderRadius: "15px",
                    "&:hover": {
                      background: "rgba(21, 101, 192, 1)",
                    },
                  }}
                >
                  {loading ? "processing..." : "Check Selection"}
                </Button>

                {/* --- THÊM NÚT TOGGLE SIDEBAR TẠI ĐÂY --- */}
                <IconButton
                  onClick={() => setShowSidebar(!showSidebar)}
                  sx={{
                    background: "rgba(255,255,255,0.5)",
                    backdropFilter: "blur(4px)",
                    transform: showSidebar ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "0.3s",
                    height: 30,
                    width: 30,
                  }}
                >
                  <MenuOpenIcon />
                </IconButton>
              </div>
            </Box>

            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                marginTop: "50px",
                padding: "0 10px",

                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "rgba(0,0,0,0.8)",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                scrollbarWidth: "thin", // Firefox
                scrollbarColor: "rgba(0,0,0,0.5) transparent",
              }}
            >
              <MDXEditor
                markdown={markdown}
                onChange={handleEditorChange}
                contentEditableClassName="mdxeditor-content zebra-striping"
                spellCheck={false}
                plugins={[
                  headingsPlugin(),
                  listsPlugin(),
                  quotePlugin(),
                  markdownShortcutPlugin(),
                  linkPlugin(),
                  linkDialogPlugin(),
                  tablePlugin(),
                  toolbarPlugin({
                    toolbarContents: () => (
                      <>
                        <UndoRedo /> <Separator />{" "}
                        <BoldItalicUnderlineToggles /> <Separator />
                        <BlockTypeSelect /> <Separator /> <ListsToggle />{" "}
                        <Separator />
                        <CreateLink /> <Separator /> <InsertTable />
                      </>
                    ),
                  }),
                ]}
              />
            </Box>
          </Box>

          {/* --- PHẦN 2: SIDEBAR REVIEW (30%) --- */}
          <Box
            sx={{
              width: showSidebar ? "30%" : "0px",
              transition: "width 0.3s ease",
              overflow: "hidden",
              height: "90%",
              marginX: showSidebar ? "15px" : "0px",
              marginY: "auto",
              borderRadius: showSidebar ? "20px" : "0px",

              background: "rgba(255, 255, 255, 0.15)",
              WebkitBackdropFilter: "blur(2px)",
              border: showSidebar ? "1px solid rgba(255,255,255,0.22)" : "none",
              boxShadow: "0 6px 24px rgba(0,0,0,0.08)",

              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                p: 2,
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexShrink: 0, // để header luôn cố định
              }}
            >
              <SmartToyIcon color="action" />
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                color="text.primary"
              >
                AI Analysis Log
              </Typography>
            </Box>

            {/* LAYER 2 — Nội dung sidebar (scroll) */}
            <Box
              sx={{
                width: "100%",
                height: "100%",
                overflowY: "auto", // CHỈ LAYER NÀY SCROLL
                display: "flex",
                flexDirection: "column",

                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "rgba(0,0,0,0.8)",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                scrollbarWidth: "thin", // Firefox
                scrollbarColor: "rgba(0,0,0,0.5) transparent",
              }}
            >
              {/* Header Sidebar */}

              {/* List Kết quả */}
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {isLoadingHistory ? (
                  // --- Loading State ---
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      mt: 4,
                      mb: 4,
                    }}
                  >
                    <CircularProgress size={32} />
                  </Box>
                ) : results.length === 0 ? (
                  // --- Empty State ---
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    textAlign="center"
                    sx={{ mt: 4 }}
                  >
                    No issues detected yet.
                    <br />
                    Select text and click "Check Selection".
                  </Typography>
                ) : (
                  results.map((res, index) => {
                    const config = getTypeConfig(res.type);

                    const displayNumber = results.length - index;
                    return (
                      <Card
                        key={res.id}
                        sx={{
                          mb: 2,
                          background: "rgba(255,255,255,0.06)", // Glass base
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid",
                          borderColor: config.border, // Màu viền theo loại
                          borderRadius: "16px",
                          boxShadow: "0 4px 24px -1px rgba(0,0,0,0.1)",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "0 8px 30px -2px rgba(0,0,0,0.15)",
                            borderColor: config.color,
                          },
                        }}
                      >
                        <CardContent sx={{ p: "16px !important" }}>
                          {/* --- ROW 1: Icon + Message | Index + Close Button --- */}
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start", // Căn lề trên để nút X không bị lệch
                              mb: 1.5,
                              pb: 1,
                              borderBottom: `1px solid ${config.border}`,
                            }}
                          >
                            {/* Left: Icon & Message */}
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mt: 0.5,
                              }}
                            >
                              {config.icon}
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  color: config.color,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {res.displayMessage}
                              </Typography>
                            </Box>

                            {/* Right: Index Number & Delete Button */}
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {/* Hiển thị số thứ tự đã tính toán */}
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.disabled",
                                  fontWeight: 600,
                                  fontFamily: "monospace",
                                  fontSize: "0.9rem",
                                }}
                              >
                                #{String(displayNumber).padStart(2, "0")}
                              </Typography>

                              {/* Nút Xóa */}
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(res.id)}
                                sx={{
                                  color: "text.disabled",
                                  padding: 0,
                                  ml: 0.5,
                                  "&:hover": {
                                    color: "error.main",
                                    bgcolor: "transparent",
                                  },
                                }}
                              >
                                <CloseIcon
                                  fontSize="small"
                                  sx={{ fontSize: "1.1rem" }}
                                />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* --- ROW 2: Sentence (New Note Sentence) --- */}
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              fontWeight: 500,
                              fontSize: "0.95rem",
                              mb: 1,
                              lineHeight: 1.5,
                            }}
                          >
                            "{res.sentence}"
                          </Typography>

                          {/* --- ROW 3: Reason / Missing Context --- */}
                          <Box sx={{ mb: 1, display: "flex", gap: 1 }}>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                fontWeight: 700,
                                minWidth: "60px",
                              }}
                            >
                              Analysis:
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.875rem",
                              }}
                            >
                              {res.reason}
                            </Typography>
                          </Box>

                          {/* --- ROW 4: Suggested Rewrite / Addition --- */}
                          <Box
                            sx={{
                              mb: 1,
                              display: "flex",
                              gap: 1,
                              p: 1,
                              borderRadius: "8px",
                              bgcolor: "rgba(255,255,255,0.03)", // Highlight nhẹ phần suggest
                              border: "1px dashed rgba(255,255,255,0.15)",
                            }}
                          >
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                color: "#4caf50", // Xanh lá cho suggestion
                                fontWeight: 700,
                                minWidth: "60px",
                                pt: 0.2,
                              }}
                            >
                              Suggest:
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.primary",
                                fontSize: "0.875rem",
                                fontStyle: "italic",
                              }}
                            >
                              {res.suggestion}
                            </Typography>
                          </Box>

                          {/* --- Expandable Sources Toggle (Chỉ hiện nếu có sources) --- */}
                          {res.sources && res.sources.length > 0 && (
                            <>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  mt: 1,
                                }}
                              >
                                <Button
                                  size="small"
                                  onClick={() => toggleExpand(res.id)}
                                  startIcon={
                                    res.expanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )
                                  }
                                  sx={{
                                    textTransform: "none",
                                    fontSize: "0.75rem",
                                    color: "text.secondary",
                                    minWidth: 0,
                                    p: "2px 8px",
                                  }}
                                >
                                  {res.expanded
                                    ? "Hide Evidence"
                                    : "View Evidence"}
                                </Button>
                              </Box>

                              {res.expanded && (
                                <Box
                                  sx={{
                                    mt: 1,
                                    p: 1.5,
                                    borderRadius: "8px",
                                    bgcolor: "rgba(0,0,0,0.1)",
                                  }}
                                >
                                  {res.sources.map((src, i) => (
                                    <Typography
                                      key={i}
                                      variant="caption"
                                      sx={{
                                        display: "block",
                                        color: "text.secondary",
                                        fontFamily: "monospace",
                                        mb: 0.5,
                                        "&:last-child": { mb: 0 },
                                      }}
                                    >
                                      • {src}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TextEditor;
