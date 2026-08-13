"use client";

import { useEffect, useRef, useState } from "react";
import { getAvatarColor, getInitials } from "./Sidebar";

interface Contact {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: number;
  } | null;
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: number;
  createdAt: string;
}

export default function MessagesClient({
  currentUserId,
}: {
  currentUserId: number;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [messagesThread, setMessagesThread] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch contact list
  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);

        // Auto-select first contact if none selected
        if (!selectedPartnerId && data.contacts?.length > 0) {
          setSelectedPartnerId(data.contacts[0].user.id);
        }
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch thread history for selected partner
  const fetchThread = async (partnerId: number) => {
    try {
      const res = await fetch(`/api/messages/${partnerId}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessagesThread(data || []);

        // Only call PATCH if there are actual unread messages from partner
        const hasUnread = (data || []).some(
          (m) => m.senderId === partnerId && m.isRead === 0
        );
        if (hasUnread) {
          await fetch(`/api/messages/${partnerId}`, { method: "PATCH" });
          setContacts((prev) =>
            prev.map((c) =>
              c.user.id === partnerId ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      }
    } catch {
      // ignore transient network errors
    }
  };

  // Initial load & smart polling (10s interval, active tab only)
  useEffect(() => {
    fetchContacts();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchContacts();
      if (selectedPartnerId) {
        fetchThread(selectedPartnerId);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedPartnerId]);

  // Load thread when selected partner changes
  useEffect(() => {
    if (selectedPartnerId) {
      fetchThread(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  // Auto-scroll chat window to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messagesThread]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPartnerId || !inputText.trim() || sending) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedPartnerId,
          content,
        }),
      });

      if (res.ok) {
        const newMsg: Message = await res.json();
        setMessagesThread((prev) => [...prev, newMsg]);
        fetchContacts();
      }
    } catch {
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const selectedContact = contacts.find(
    (c) => c.user.id === selectedPartnerId
  );

  const filteredContacts = contacts.filter(
    (c) =>
      c.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      {/* --- Left Sidebar: Contact List --- */}
      <div className="flex w-80 flex-col border-r border-slate-200 bg-slate-50/60">
        {/* Contacts Header & Search */}
        <div className="border-b border-slate-200 p-4">
          <h1 className="text-lg font-extrabold text-slate-900">Messages</h1>
          <p className="text-xs text-slate-500">Chat with admin & team members</p>
          <div className="mt-3">
            <input
              type="text"
              placeholder="Search team members…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading contacts…</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">No team members found</div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = contact.user.id === selectedPartnerId;
              return (
                <button
                  key={contact.user.id}
                  onClick={() => setSelectedPartnerId(contact.user.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "hover:bg-slate-200/60 text-slate-800"
                  }`}
                >
                  {/* User Avatar */}
                  <div className="relative">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${getAvatarColor(
                        contact.user.name
                      )}`}
                    >
                      {getInitials(contact.user.name)}
                    </div>
                  </div>

                  {/* Info & Last Message */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-bold">
                        {contact.user.name}
                      </span>
                      {contact.user.role === "admin" && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                            isSelected
                              ? "bg-amber-400 text-slate-900"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Admin
                        </span>
                      )}
                    </div>

                    <div
                      className={`truncate text-[11px] mt-0.5 ${
                        isSelected ? "text-emerald-100" : "text-slate-500"
                      }`}
                    >
                      {contact.lastMessage
                        ? `${
                            contact.lastMessage.senderId === currentUserId
                              ? "You: "
                              : ""
                          }${contact.lastMessage.content}`
                        : "Start a conversation"}
                    </div>
                  </div>

                  {/* Unread Badge */}
                  {contact.unreadCount > 0 && (
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white shadow-sm">
                      {contact.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- Right Main Chat Panel --- */}
      {selectedContact ? (
        <div className="flex flex-1 flex-col bg-slate-50/30">
          {/* Active Partner Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(
                  selectedContact.user.name
                )}`}
              >
                {getInitials(selectedContact.user.name)}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedContact.user.name}
                </h2>
                <div className="text-[10px] text-slate-400">
                  {selectedContact.user.email} · {selectedContact.user.role}
                </div>
              </div>
            </div>
            {selectedContact.user.role === "admin" && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                👑 System Admin
              </span>
            )}
          </div>

          {/* Messages Feed */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-3"
          >
            {messagesThread.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <span className="text-3xl mb-2">💬</span>
                <p className="text-xs font-medium">No messages yet with {selectedContact.user.name}.</p>
                <p className="text-[11px] text-slate-400 mt-1">Send a message below to start chatting.</p>
              </div>
            ) : (
              messagesThread.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                        isMe
                          ? "bg-emerald-600 text-white rounded-br-none font-medium"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="mt-1 text-[9px] text-slate-400 px-1">
                      {formattedTime}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-200 bg-white p-3 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={`Write a message to ${selectedContact.user.name}…`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <span>{sending ? "Sending…" : "Send"}</span>
              <span>➔</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-xs">
          Select a contact to start messaging
        </div>
      )}
    </div>
  );
}
