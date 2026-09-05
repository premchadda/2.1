import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  AnimatedHero,
  Card,
  Button,
  Badge,
  ScrollReveal,
} from "../../shared/components";
import { api } from "../../shared/lib/dataService";
import { streamChat, isStreamingSupported } from "../../shared/lib/aiStreaming";
import { getCachedResponse, setCachedResponse } from "../../shared/lib/aiCache";
import {
  routeTask,
  inferComplexity,
  TASK_TYPES,
} from "../../shared/lib/aiRouter";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Brain,
  Clock,
  CheckCircle,
  Target,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Zap,
  BarChart3,
  Loader2,
  Send,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const typeConfig = {
  practice: {
    icon: Zap,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  test: {
    icon: BookOpen,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
  },
  revision: {
    icon: Target,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
  },
  study: {
    icon: Brain,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
  },
};

function AIStudyPlanner() {
  const { user } = useAuth();
  const _queryClient = useQueryClient();
  const today = new Date();
  // Use local date components to avoid UTC midnight mismatch in non-UTC timezones
  const localKey = () =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const chatEndRef = useRef(null);
  const abortRef = useRef(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Abort any in-flight AI stream when the component unmounts (was leaking
  // fetch/SSE readers + calling setChatMessages on dead components + wasting
  // OpenRouter tokens).
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort?.();
        abortRef.current = null;
      }
      if (pendingRef.current) {
        pendingRef.current = false;
      }
    };
  }, []);

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text || pendingRef.current || isStreaming) return;

    pendingRef.current = true;
    const userMsg = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    const cacheKey = `chat:${user?.id}:${text}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: cached },
      ]);
      pendingRef.current = false;
      return;
    }

    const route = routeTask(TASK_TYPES.CHAT, inferComplexity(text));
    const allMessages = [...chatMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Non-streaming path with AbortController guard
    if (!isStreamingSupported()) {
      const abortCtrl = new AbortController();
      pendingRef.current = true;
      abortRef.current = abortCtrl;
      api
        .post(
          "/api/ai/mentor/chat",
          { messages: allMessages, conversationId, ...route },
          { signal: abortCtrl.signal },
        )
        .then((res) => {
          pendingRef.current = false;
          abortRef.current = null;
          const reply =
            res.data?.data?.content || res.data?.data || "No response";
          const serverConvId =
            res.data?.data?.conversationId || res.data?.conversationId;
          if (serverConvId) setConversationId(serverConvId);
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply },
          ]);
          setCachedResponse(cacheKey, reply);
        })
        .catch((err) => {
          pendingRef.current = false;
          if (abortRef.current !== abortCtrl) {
            // Request was aborted (unmount or new request); ignore
            return;
          }
          abortRef.current = null;
          toast.error(err.message || "Failed to get response");
        })
        .finally(() => {
          if (abortRef.current === abortCtrl) {
            abortRef.current = null;
          }
          setIsStreaming(false);
          pendingRef.current = false;
        });
      return;
    }

    setIsStreaming(true);
    let assistantText = "";
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = streamChat(
      allMessages,
      ({ text: chunk, done, raw, error }) => {
        if (error) {
          pendingRef.current = false;
          toast.error(error);
          // Remove the empty placeholder assistant message and show error
          setChatMessages((prev) => {
            const updated = prev.filter(
              (m) =>
                m.role !== "assistant" || prev[prev.length - 1].content !== "",
            );
            if (
              prev[prev.length - 1]?.role === "assistant" &&
              prev[prev.length - 1]?.content === ""
            ) {
              updated.pop();
            }
            return updated;
          });
          setIsStreaming(false);
          abortRef.current = null;
          return;
        }
        if (raw?.conversationId) setConversationId(raw.conversationId);
        if (chunk) assistantText += chunk;
        if (done) {
          pendingRef.current = false;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            return updated;
          });
          if (assistantText) {
            setCachedResponse(cacheKey, assistantText);
          }
          setIsStreaming(false);
          abortRef.current = null;
        } else {
          pendingRef.current = false;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            return updated;
          });
        }
      },
      conversationId,
    );
  }, [chatInput, isStreaming, chatMessages, user, conversationId]);

  const cancelStream = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const { data: recommendations = [], isLoading: loadingRecs } = useQuery({
    queryKey: ["intelligence-recommendations"],
    queryFn: async () => {
      const res = await api.get("/api/intelligence/recommendations?limit=10");
      const rawData = res.data?.data;
      if (!rawData) return [];
      if (Array.isArray(rawData)) return rawData;
      const suggestions = rawData.dashboardSuggestions || [];
      const tests = (rawData.recommendedTests || []).map((t) => ({
        title: `Practice Test: ${t.title}`,
        recommendation: `Attempt ${t.title} under ${t.category || ""}`,
        actionUrl: `/test-series`,
        type: "test",
      }));
      const chapters = (rawData.recommendedChapters || []).map((c) => ({
        title: `Study Chapter: ${c.name}`,
        recommendation: `Revise ${c.name} in ${c.subject}`,
        actionUrl: `/study`,
        type: "study",
      }));
      return [...suggestions, ...tests, ...chapters];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: weakTopics = [] } = useQuery({
    queryKey: ["intelligence-weak-topics"],
    queryFn: async () => {
      const res = await api.get(
        "/api/intelligence/weak-topics?minAttempts=3&limit=5",
      );
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: streakData } = useQuery({
    queryKey: ["intelligence-streak"],
    queryFn: async () => {
      const res = await api.get("/api/intelligence/streak");
      const data = res.data?.data || {};
      return {
        current: data.currentStreak ?? 0,
        longest: data.bestStreak ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get("/api/intelligence/recommendations?limit=14");
      const rawData = res.data?.data;
      if (!rawData) return [];
      if (Array.isArray(rawData)) return rawData;
      const suggestions = rawData.dashboardSuggestions || [];
      const tests = (rawData.recommendedTests || []).map((t) => ({
        title: `Practice Test: ${t.title}`,
        recommendation: `Attempt ${t.title} under ${t.category || ""}`,
        actionUrl: `/test-series`,
        type: "test",
      }));
      const chapters = (rawData.recommendedChapters || []).map((c) => ({
        title: `Study Chapter: ${c.name}`,
        recommendation: `Revise ${c.name} in ${c.subject}`,
        actionUrl: `/study`,
        type: "study",
      }));
      return [...suggestions, ...tests, ...chapters];
    },
    onSuccess: (data) => {
      const plan = buildWeeklyPlan(data, weakTopics, currentWeekStart);
      setGeneratedPlan(plan);
      toast.success("AI study plan generated!");
    },
    onError: () => toast.error("Failed to generate plan. Try again later."),
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const schedule =
    generatedPlan ||
    buildDefaultSchedule(recommendations, weakTopics, currentWeekStart);

  const getDaySchedule = (date) => {
    const key = date.toISOString().split("T")[0];
    return schedule[key] || [];
  };

  // Stats from real data
  const weeklyStats = computeWeeklyStats(
    schedule,
    currentWeekStart,
    streakData,
  );

  const weekLabel =
    currentWeekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) +
    " – " +
    new Date(currentWeekStart.getTime() + 6 * 86400000).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      <AnimatedHero pageType="dashboard" compact>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl font-bold text-white">
              AI Study Planner
            </h1>
            <p className="text-purple-100 text-sm mt-1">
              Personalized weekly schedule powered by AI
            </p>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-20">
        <ScrollReveal>
          {/* Week Navigation */}
          <Card variant="elevated" className="mb-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-start" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {weekLabel}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={nextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </ScrollReveal>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            {
              icon: Brain,
              label: "Study Sessions",
              value: weeklyStats.sessions,
              color: "text-blue-500",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              icon: Clock,
              label: "Hours This Week",
              value: weeklyStats.hours,
              color: "text-purple-500",
              bg: "bg-purple-50 dark:bg-purple-900/20",
            },
            {
              icon: CheckCircle,
              label: "Current Streak",
              value: `${streakData?.current || 0}d`,
              color: "text-green-500",
              bg: "bg-green-50 dark:bg-green-900/20",
            },
            {
              icon: Target,
              label: "Weak Topics",
              value: weakTopics.length,
              color: "text-orange-500",
              bg: "bg-orange-50 dark:bg-orange-900/20",
            },
          ].map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.05}>
              <Card variant="elevated" size="md">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {loadingRecs ? (
                        <span className="inline-block w-8 h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Generate Schedule Button */}
        <ScrollReveal delay={0.1}>
          <Card variant="gradient" size="lg" className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  AI-Powered Schedule
                </h3>
                <p className="text-white/70 text-sm mt-1">
                  {recommendations.length > 0
                    ? `${recommendations.length} personalized recommendations ready based on your performance`
                    : "Let AI analyze your performance and create an optimized study plan"}
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="bg-white text-brand-start hover:bg-gray-100"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Plan
                  </>
                )}
              </Button>
            </div>
          </Card>
        </ScrollReveal>

        {/* Weekly Calendar */}
        <ScrollReveal delay={0.15}>
          <Card variant="elevated" className="mb-6 overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
              {weekDays.map((date, i) => {
                const daySchedule = getDaySchedule(date);
                const todayMatch = isToday(date);
                return (
                  <div
                    key={i}
                    className={`bg-white dark:bg-gray-800 p-2 min-h-[120px] ${
                      todayMatch ? "ring-2 ring-brand-start ring-inset" : ""
                    }`}
                  >
                    <div
                      className={`text-center mb-1 ${todayMatch ? "bg-brand-start text-white rounded-lg py-1" : ""}`}
                    >
                      <p
                        className={`text-[10px] font-medium ${todayMatch ? "text-white" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {DAYS[date.getDay()]}
                      </p>
                      <p
                        className={`text-sm font-bold ${todayMatch ? "text-white" : "text-gray-900 dark:text-white"}`}
                      >
                        {date.getDate()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {daySchedule.slice(0, 2).map((item, j) => {
                        const config =
                          typeConfig[item.type] || typeConfig.practice;
                        return (
                          <div
                            key={j}
                            className={`text-[9px] px-1 py-0.5 rounded ${config.bg} ${config.border} border`}
                            title={`${item.title} (${item.time})`}
                          >
                            <div className="flex items-center gap-0.5">
                              <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                                {item.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {daySchedule.length > 2 && (
                        <p className="text-[9px] text-brand-start dark:text-indigo-400 font-medium text-center">
                          +{daySchedule.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </ScrollReveal>

        {/* Detailed Schedule for Today */}
        <ScrollReveal delay={0.2}>
          <Card variant="elevated" className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Today's Schedule
            </h3>
            {getDaySchedule(today).length > 0 ? (
              <div className="space-y-3">
                {getDaySchedule(today).map((item, i) => {
                  const config = typeConfig[item.type] || typeConfig.practice;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-4 p-3 rounded-xl ${config.bg} border ${config.border}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}
                      >
                        <config.icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                          <span>{item.duration}</span>
                          <Badge
                            variant={
                              item.type === "test"
                                ? "warning"
                                : item.type === "practice"
                                  ? "primary"
                                  : "success"
                            }
                            size="xs"
                          >
                            {item.type}
                          </Badge>
                        </div>
                      </div>
                      {item.route && (
                        <Link to={item.route}>
                          <Button variant="outline" size="sm">
                            Start
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  No sessions scheduled for today
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Generate a plan to get started
                </p>
              </div>
            )}
          </Card>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={0.25}>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                icon: BarChart3,
                label: "Performance Analysis",
                route: "/analysis",
                color: "text-purple-500",
              },
              {
                icon: BookOpen,
                label: "Mock Tests",
                route: "/test-series",
                color: "text-blue-500",
              },
              {
                icon: Target,
                label: "Weak Areas",
                route: "/dashboard/insights",
                color: "text-orange-500",
              },
              {
                icon: Clock,
                label: "Study History",
                route: "/dashboard",
                color: "text-green-500",
              },
            ].map((action) => (
              <Link key={action.label} to={action.route}>
                <Card variant="ghost" hover size="md" className="text-center">
                  <action.icon
                    className={`w-6 h-6 ${action.color} mx-auto mb-2`}
                  />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action.label}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </ScrollReveal>

        {/* Floating Chat Toggle */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-brand-start to-brand-end text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="AI Mentor Chat"
        >
          {chatOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageSquare className="w-6 h-6" />
          )}
        </button>

        {/* Streaming Chat Panel */}
        {chatOpen && (
          <div
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            style={{ height: "480px" }}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gradient-to-r from-brand-start/10 to-brand-end/10">
              <Brain className="w-5 h-5 text-brand-start" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                AI Mentor
              </span>
              {isStreamingSupported() && (
                <Badge variant="success" size="xs">
                  streaming
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-12">
                  <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Ask anything about your prep</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-brand-start text-white rounded-br-none"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
                    }`}
                  >
                    {msg.content ||
                      (isStreaming && i === chatMessages.length - 1 ? (
                        <span className="inline-flex gap-1">
                          <span className="animate-bounce">.</span>
                          <span
                            className="animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          >
                            .
                          </span>
                        </span>
                      ) : (
                        ""
                      ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && sendChatMessage()
                }
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-start/50"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  onClick={cancelStream}
                  className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={sendChatMessage}
                  className="p-2 rounded-xl bg-brand-start text-white hover:bg-brand-start/80 transition-colors disabled:opacity-50"
                  disabled={!chatInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Build a weekly plan from AI recommendations + weak topics
function buildWeeklyPlan(recommendations, weakTopics, weekStart) {
  const plan = {};
  const timeSlots = ["09:00", "11:00", "14:00", "16:00", "18:00"];
  let recIndex = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    const key = date.toISOString().split("T")[0];
    plan[key] = [];

    // Assign 1-2 recommendations per day
    const slotsForDay = dayOffset === 0 || dayOffset === 6 ? 2 : 1;
    for (let s = 0; s < slotsForDay && recIndex < recommendations.length; s++) {
      const rec = recommendations[recIndex];
      plan[key].push({
        time: timeSlots[s % timeSlots.length],
        title: rec.title || rec.recommendation || "Study Session",
        duration: rec.duration || "1h",
        type: rec.type || (rec.actionType === "test" ? "test" : "study"),
        route: rec.route || rec.actionUrl || "/test-series",
      });
      recIndex++;
    }

    // Add weak topic revision on alternate days
    if (dayOffset % 2 === 1 && weakTopics[0]) {
      plan[key].push({
        time: "16:00",
        title: `Revise: ${weakTopics[0].topic || weakTopics[0].name}`,
        duration: "45m",
        type: "revision",
        route: `/study`,
      });
    }
  }

  return plan;
}

// Fallback schedule from recommendations (without "Generate" click)
function buildDefaultSchedule(recommendations, weakTopics, weekStart) {
  if (recommendations.length === 0) return {};
  return buildWeeklyPlan(recommendations, weakTopics, weekStart);
}

function computeWeeklyStats(schedule, weekStart, _streakData) {
  let sessions = 0;
  let hours = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    const key = date.toISOString().split("T")[0];
    const dayItems = schedule[key] || [];
    sessions += dayItems.length;
    dayItems.forEach((item) => {
      const hoursMatch = item.duration?.match(/([\d.]+)\s*h/);
      if (hoursMatch) hours += parseFloat(hoursMatch[1]);
      else if (item.duration?.includes("m")) {
        const minMatch = item.duration.match(/([\d.]+)\s*m/);
        if (minMatch) hours += parseFloat(minMatch[1]) / 60;
      } else {
        hours += 1;
      }
    });
  }

  return { sessions, hours: hours.toFixed(1) };
}

export default AIStudyPlanner;
