<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { useNotifications } from '../composables/useNotifications'
import {
  getConversation,
  getConversations,
  loadProtectedImage,
  markConversationRead,
  sendImageMessage,
  sendMessage,
} from '../services/messageService'
import { getErrorMessage } from '../utils/errors'
import type { ConversationItem, MessageItem } from '../types/api'
import EmptyState from '../components/common/Emptystate.vue'
import PageHeader from '../components/common/Pageheader.vue'

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const { error: showError } = useNotifications()

const conversations = ref<ConversationItem[]>([])
const messages = ref<MessageItem[]>([])
const selectedConversation = ref<ConversationItem>()
const conversationsLoading = ref(false)
const messagesLoading = ref(false)
const olderMessagesLoading = ref(false)
const currentConversationPage = ref(1)
const hasMoreMessages = ref(false)
const sending = ref(false)
const text = ref('')
const search = ref('')
const imageFile = ref<File>()
const imagePreview = ref('')
const imageDialog = ref(false)
const dialogImageUrl = ref('')
const imageInput = ref<HTMLInputElement>()
const threadBody = ref<HTMLElement>()
const messageImageUrls = ref<Record<string, string>>({})
const userImageUrls = ref<Record<string, string>>({})
const typingTimer = ref<number>()
const isMobileMessages = ref(false)
let mobileMediaQuery: MediaQueryList | undefined
const conversationPageSize = 10

const selectedUserId = computed(() => selectedConversation.value?.otherUserId ?? '')
const canUseMessages = computed(() => auth.hasAnyRole(['DoctorUser']))
const selectedTyping = computed(() => messagesStore.typingUserId === selectedUserId.value)
const hasDraft = computed(() => Boolean(text.value.trim() || imageFile.value))
const filteredConversations = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return conversations.value
  return conversations.value.filter((item) =>
    [item.otherUserName, item.lastMessage].some((value) => value?.toLowerCase().includes(q)),
  )
})
function isFirstMessageOfDay(message: MessageItem) {
  const index = messages.value.findIndex((item) => item.id === message.id)
  if (index <= 0) return true
  return dateKey(messages.value[index - 1].sentAt) !== dateKey(message.sentAt)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  if (sameDay) return formatTime(value)
  return new Intl.DateTimeFormat('ar-IQ', { month: 'short', day: 'numeric' }).format(date)
}

function dateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function formatFullDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'اليوم'
  if (date.toDateString() === yesterday.toDateString()) return 'أمس'

  return new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function otherName(message: MessageItem) {
  return message.senderId === selectedUserId.value ? message.senderName : message.receiverName
}

function isMine(message: MessageItem) {
  return message.receiverId === selectedUserId.value
}

function initials(name?: string) {
  const clean = name?.trim()
  return clean ? clean.slice(0, 2) : 'م'
}

function cleanupObjectUrls(urls: Record<string, string>) {
  Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
}

function scrollToBottom() {
  nextTick(() => {
    const el = threadBody.value
    if (!el) return

    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    window.setTimeout(() => {
      el.scrollTop = el.scrollHeight
    }, 120)
  })
}

function updateMobileMode() {
  isMobileMessages.value = mobileMediaQuery?.matches ?? false
}

async function ensureUserImage(userId: string, imageName?: string) {
  if (!imageName || userImageUrls.value[userId]) return
  const url = await loadProtectedImage('user-profile-image', imageName)
  if (url) userImageUrls.value = { ...userImageUrls.value, [userId]: url }
}

async function ensureMessageImage(message: MessageItem) {
  if (!message.imageName || messageImageUrls.value[message.id]) return
  const url = await loadProtectedImage('message-image', message.imageName)
  if (url) messageImageUrls.value = { ...messageImageUrls.value, [message.id]: url }
}

async function hydrateImages(items: MessageItem[]) {
  await Promise.all(items.map((item) => ensureMessageImage(item)))
}

async function loadConversations(keepSelection = true) {
  conversationsLoading.value = true
  try {
    conversations.value = await getConversations()
    await Promise.all(conversations.value.map((item) => ensureUserImage(item.otherUserId, item.otherUserImage)))

    if (keepSelection && selectedConversation.value) {
      const refreshed = conversations.value.find((item) => item.otherUserId === selectedConversation.value?.otherUserId)
      if (refreshed) selectedConversation.value = refreshed
    }
  } catch (e: any) {
    if (e.response?.status === 404) conversations.value = []
    else showError(getErrorMessage(e))
  } finally {
    conversationsLoading.value = false
  }
}

async function selectConversation(conversation: ConversationItem) {
  selectedConversation.value = conversation
  messagesLoading.value = true
  currentConversationPage.value = 1
  hasMoreMessages.value = false
  try {
    const result = await getConversation(conversation.otherUserId, currentConversationPage.value, conversationPageSize)
    messages.value = result.messages
    hasMoreMessages.value = result.hasMore
    await hydrateImages(messages.value)
    await markConversationRead(conversation.otherUserId).catch(() => {})
    await messagesStore.markReadViaHub(conversation.otherUserId)
    conversation.unreadCount = 0
    await messagesStore.refreshUnreadCount()
    scrollToBottom()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    messagesLoading.value = false
  }
}

async function loadOlderMessages() {
  if (!selectedConversation.value || olderMessagesLoading.value || messagesLoading.value || !hasMoreMessages.value) return

  const el = threadBody.value
  const previousScrollHeight = el?.scrollHeight ?? 0
  const previousScrollTop = el?.scrollTop ?? 0
  olderMessagesLoading.value = true

  try {
    const nextPage = currentConversationPage.value + 1
    const result = await getConversation(selectedConversation.value.otherUserId, nextPage, conversationPageSize)
    const existingIds = new Set(messages.value.map((item) => item.id))
    const olderMessages = result.messages.filter((item) => !existingIds.has(item.id))

    currentConversationPage.value = nextPage
    hasMoreMessages.value = result.hasMore

    if (olderMessages.length) {
      messages.value = [...olderMessages, ...messages.value]
      await hydrateImages(olderMessages)
      await nextTick()

      const updatedEl = threadBody.value
      if (updatedEl) {
        updatedEl.scrollTop = updatedEl.scrollHeight - previousScrollHeight + previousScrollTop
        window.setTimeout(() => {
          updatedEl.scrollTop = updatedEl.scrollHeight - previousScrollHeight + previousScrollTop
        }, 120)
      }
    }
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    olderMessagesLoading.value = false
  }
}

function handleThreadScroll() {
  const el = threadBody.value
  if (!el || el.scrollTop > 80) return
  loadOlderMessages()
}

function backToConversations() {
  selectedConversation.value = undefined
  messages.value = []
  currentConversationPage.value = 1
  hasMoreMessages.value = false
}

function setImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  clearImage()
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    showError('الصورة يجب أن تكون JPG أو PNG أو WEBP وبحجم لا يتجاوز 5MB.')
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function clearImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = undefined
  imagePreview.value = ''
  if (imageInput.value) imageInput.value.value = ''
}

function openImageDialog(url: string) {
  dialogImageUrl.value = url
  imageDialog.value = true
}

function closeImageDialog() {
  imageDialog.value = false
  dialogImageUrl.value = ''
}

async function submit() {
  if (!selectedConversation.value || !hasDraft.value || sending.value) return
  sending.value = true
  const receiverId = selectedConversation.value.otherUserId
  const content = text.value.trim()

  try {
    if (imageFile.value) {
      const saved = await sendImageMessage(receiverId, imageFile.value, content)
      messages.value = [...messages.value, saved]
      await ensureMessageImage(saved)
      clearImage()
    } else {
      const sentByHub = await messagesStore.sendViaHub(receiverId, content).catch(() => false)
      if (!sentByHub) {
        const saved = await sendMessage({ receiverId, content })
        messages.value = [...messages.value, saved]
      }
    }
    text.value = ''
    await messagesStore.sendStopTyping(receiverId)
    await loadConversations(true)
    scrollToBottom()
  } catch (e) {
    showError(getErrorMessage(e))
  } finally {
    sending.value = false
  }
}

function handleTyping() {
  if (!selectedUserId.value) return
  messagesStore.sendTyping(selectedUserId.value)
  if (typingTimer.value) window.clearTimeout(typingTimer.value)
  typingTimer.value = window.setTimeout(() => {
    messagesStore.sendStopTyping(selectedUserId.value)
  }, 1300)
}

function handleIncoming(message: MessageItem | null) {
  if (!message) return
  const belongsToActive = message.senderId === selectedUserId.value || message.receiverId === selectedUserId.value
  if (belongsToActive && !messages.value.some((item) => item.id === message.id)) {
    messages.value = [...messages.value, message]
    ensureMessageImage(message)
    markConversationRead(selectedUserId.value).catch(() => {})
    messagesStore.markReadViaHub(selectedUserId.value)
    scrollToBottom()
  }
  loadConversations(true)
}

watch(() => messagesStore.lastMessage, handleIncoming)
watch(() => messagesStore.sentMessage, handleIncoming)
watch(() => messagesStore.conversationsVersion, () => loadConversations(true))

onMounted(async () => {
  mobileMediaQuery = window.matchMedia('(max-width: 900px)')
  updateMobileMode()
  mobileMediaQuery.addEventListener('change', updateMobileMode)

  if (!canUseMessages.value) return
  await messagesStore.connect()
  await loadConversations(false)
})

onUnmounted(() => {
  mobileMediaQuery?.removeEventListener('change', updateMobileMode)
  if (typingTimer.value) window.clearTimeout(typingTimer.value)
  clearImage()
  cleanupObjectUrls(messageImageUrls.value)
  cleanupObjectUrls(userImageUrls.value)
})
</script>

<template>
  <div class="messages-page">
    <PageHeader
      title="الرسائل"
      subtitle="متابعة رسائل المراجعين والرد عليهم مباشرة"
    >
      <template #actions>
        <!-- <v-chip
          size="small"
          :color="messagesStore.isConnected ? 'success' : 'warning'"
          variant="tonal"
        >
          <v-icon :icon="messagesStore.isConnected ? 'mdi-wifi' : 'mdi-wifi-off'" start size="16" />
          {{ messagesStore.isConnected ? 'متصل' : 'اتصال محدود' }}
        </v-chip> -->
        <v-btn
          color="primary"
          variant="outlined"
          prepend-icon="mdi-refresh"
          :loading="conversationsLoading"
          @click="loadConversations(true)"
        >
          تحديث
        </v-btn>
      </template>
    </PageHeader>

    <v-alert
      v-if="!canUseMessages"
      type="warning"
      variant="tonal"
      border="start"
      class="messages-alert"
    >
      الرسائل متاحة لحساب الطبيب فقط.
    </v-alert>

    <div
      v-else
      class="messages-shell"
      :class="{ 'messages-shell--chat-open': Boolean(selectedConversation) }"
    >
      <aside class="conversations-panel">
        <div class="panel-toolbar">
          <div>
            <strong>المحادثات</strong>
            <span>{{ conversations.length }} محادثة</span>
          </div>
          <v-badge
            :content="messagesStore.unreadCount"
            :model-value="messagesStore.unreadCount > 0"
            color="error"
          >
            <v-icon icon="mdi-message-badge" color="primary" size="24" />
          </v-badge>
        </div>

        <div class="search-box">
          <v-icon icon="mdi-magnify" size="18" />
          <input v-model="search" type="search" placeholder="بحث عن مراجع" />
        </div>

        <div v-if="conversationsLoading" class="conversation-loading">
          <v-skeleton-loader v-for="i in 6" :key="i" type="list-item-avatar-two-line" />
        </div>

        <EmptyState
          v-else-if="!filteredConversations.length"
          icon="mdi-message-outline"
          title="لا توجد محادثات"
          description="ستظهر هنا رسائل المراجعين عند توفر محادثات فعالة."
        />

        <div v-else class="conversation-list">
          <button
            v-for="conversation in filteredConversations"
            :key="conversation.otherUserId"
            class="conversation-item"
            :class="{ 'conversation-item--active': conversation.otherUserId === selectedUserId }"
            @click="selectConversation(conversation)"
          >
            <v-avatar size="44" color="primary" class="conversation-avatar">
              <img
                v-if="userImageUrls[conversation.otherUserId]"
                :src="userImageUrls[conversation.otherUserId]"
                :alt="conversation.otherUserName"
              />
              <span v-else>{{ initials(conversation.otherUserName) }}</span>
            </v-avatar>

            <div class="conversation-main">
              <div class="conversation-title">
                <strong>{{ conversation.otherUserName || 'مراجع' }}</strong>
                <time>{{ formatDate(conversation.lastMessageAt) }}</time>
              </div>
              <p>
                <v-icon
                  v-if="conversation.lastMessageImageName"
                  icon="mdi-image"
                  size="14"
                />
                {{ conversation.lastMessage || 'صورة' }}
              </p>
            </div>

            <v-chip
              v-if="conversation.unreadCount > 0"
              color="error"
              size="x-small"
              variant="flat"
            >
              {{ conversation.unreadCount }}
            </v-chip>
          </button>
        </div>
      </aside>

      <section class="chat-panel">
        <div v-if="!selectedConversation" class="chat-empty">
          <EmptyState
            icon="mdi-forum-outline"
            title="اختر محادثة"
            description="اختر مراجعاً من القائمة لعرض الرسائل والرد."
          />
        </div>

        <template v-else>
          <header class="chat-header">
            <v-btn
              icon
              variant="text"
              class="mobile-back-btn"
              aria-label="الرجوع للمحادثات"
              @click="backToConversations"
            >
              <v-icon icon="mdi-keyboard-backspace" />
            </v-btn>

            <div class="chat-person">
              <v-avatar size="42" color="primary">
                <img
                  v-if="userImageUrls[selectedConversation.otherUserId]"
                  :src="userImageUrls[selectedConversation.otherUserId]"
                  :alt="selectedConversation.otherUserName"
                />
                <span v-else>{{ initials(selectedConversation.otherUserName) }}</span>
              </v-avatar>
              <div>
                <strong>{{ selectedConversation.otherUserName || 'مراجع' }}</strong>
                <span>{{ selectedTyping ? 'يكتب الآن...' : 'محادثة مراجع' }}</span>
              </div>
            </div>
          </header>

          <div ref="threadBody" class="thread-body" @scroll="handleThreadScroll">
            <div v-if="messagesLoading" class="messages-loading">
              <v-skeleton-loader v-for="i in 5" :key="i" type="paragraph" />
            </div>

            <div v-else class="thread-content">
              <div v-if="olderMessagesLoading" class="older-loader">
                <v-progress-circular indeterminate color="primary" size="18" width="2" />
                <span>جاري تحميل رسائل أقدم...</span>
              </div>

              <div v-else-if="!hasMoreMessages && messages.length > conversationPageSize" class="older-loader older-loader--done">
                <span>بداية المحادثة</span>
              </div>

              <div
                v-for="message in messages"
                :key="message.id"
                class="message-group"
                :class="{ 'message-group--mine': isMine(message) }"
              >
                <div v-if="isFirstMessageOfDay(message)" class="date-separator">
                  <span>{{ formatFullDate(message.sentAt) }}</span>
                </div>

                <div class="message-bubble">
                  <img
                    v-if="message.imageName && messageImageUrls[message.id]"
                    :src="messageImageUrls[message.id]"
                    class="message-image"
                    role="button"
                    tabindex="0"
                    @click="openImageDialog(messageImageUrls[message.id])"
                    @keydown.enter.prevent="openImageDialog(messageImageUrls[message.id])"
                    @keydown.space.prevent="openImageDialog(messageImageUrls[message.id])"
                    alt="صورة مرسلة"
                  />
                  <p v-if="message.content">{{ message.content }}</p>
                  <div class="message-meta">
                    <span>{{ isMine(message) ? 'أنت' : otherName(message) }}</span>
                    <time>{{ formatTime(message.sentAt) }}</time>
                    <v-icon
                      v-if="isMine(message)"
                      :icon="message.isRead ? 'mdi-check-all' : 'mdi-check'"
                      size="14"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form class="composer" @submit.prevent="submit">
            <div v-if="imagePreview" class="image-draft">
              <img :src="imagePreview" alt="معاينة الصورة" />
              <button type="button" @click="clearImage">
                <v-icon icon="mdi-close" size="16" />
              </button>
            </div>

            <div class="composer-row">
              <input
                ref="imageInput"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                class="hidden-file"
                @change="setImage"
              />
              <v-btn
                icon
                variant="tonal"
                color="primary"
                type="button"
                aria-label="إرفاق صورة"
                @click="imageInput?.click()"
              >
                <v-icon icon="mdi-image-plus" />
              </v-btn>

              <textarea
                v-model="text"
                rows="1"
                maxlength="1000"
                placeholder="اكتب الرد..."
                @input="handleTyping"
                @keydown.enter.exact.prevent="submit"
              />

              <v-btn
                icon
                color="primary"
                type="submit"
                :loading="sending"
                :disabled="!hasDraft || sending"
                aria-label="إرسال"
              >
                <v-icon icon="mdi-send" />
              </v-btn>
            </div>
          </form>
        </template>
      </section>
    </div>

    <v-dialog
      v-model="imageDialog"
      max-width="980"
      class="message-image-dialog"
      @update:model-value="(value) => !value && closeImageDialog()"
    >
      <v-card class="image-dialog-card">
        <div class="image-dialog-toolbar">
          <strong>معاينة الصورة</strong>
          <v-btn
            icon
            variant="text"
            aria-label="إغلاق"
            @click="closeImageDialog"
          >
            <v-icon icon="mdi-close" />
          </v-btn>
        </div>
        <div class="image-dialog-body">
          <img v-if="dialogImageUrl" :src="dialogImageUrl" alt="معاينة الصورة" />
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.messages-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.messages-alert {
  border-radius: var(--radius-lg);
}

.messages-shell {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  height: min(760px, calc(100vh - 190px));
  min-height: 560px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.conversations-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-variant);
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.panel-toolbar strong {
  display: block;
  color: var(--color-text);
  font-size: 15px;
}

.panel-toolbar span {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: var(--spacing-md);
  padding: 0 12px;
  min-height: 42px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
}

.conversation-loading {
  padding: var(--spacing-sm);
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.conversation-item:hover,
.conversation-item--active {
  border-color: rgba(19, 121, 107, 0.18);
  background: var(--color-primary-soft);
}

.conversation-avatar {
  flex: 0 0 auto;
  font-weight: 800;
}

.conversation-avatar img,
.chat-person img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conversation-main {
  flex: 1;
  min-width: 0;
}

.conversation-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.conversation-title strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-title time {
  flex: 0 0 auto;
  color: var(--color-text-muted);
  font-size: 11px;
}

.conversation-main p {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background:
    linear-gradient(180deg, rgba(228, 244, 240, 0.35), rgba(246, 249, 248, 0.8)),
    var(--color-background);
}

.chat-empty {
  display: grid;
  place-items: center;
  height: 100%;
  padding: var(--spacing-xl);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.92);
}

.mobile-back-btn {
  display: none;
  flex: 0 0 auto;
}

.chat-person {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 0;
}

.chat-person strong,
.chat-person span {
  display: block;
}

.chat-person strong {
  color: var(--color-text);
  font-size: 15px;
}

.chat-person span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.thread-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-xl);
}

.thread-content {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 100%;
}

.older-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.older-loader--done span {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
}

.messages-loading {
  display: grid;
  gap: var(--spacing-md);
}

.message-group {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.message-group--mine {
  align-items: flex-end;
}

.message-bubble {
  max-width: min(72%, 560px);
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  border-start-start-radius: 3px;
  background: var(--color-surface);
  box-shadow: 0 4px 14px rgba(22, 49, 45, 0.05);
}

.message-group--mine .message-bubble {
  border-color: rgba(19, 121, 107, 0.18);
  border-start-start-radius: 8px;
  border-start-end-radius: 3px;
  background: #dff3ee;
}

.date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 10px 0 16px;
  color: var(--color-text-muted);
}

.date-separator::before,
.date-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.date-separator span {
  flex: 0 0 auto;
  margin-inline: var(--spacing-md);
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.message-bubble p {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message-image {
  display: block;
  width: min(320px, 100%);
  max-height: 300px;
  margin-bottom: 8px;
  border-radius: 6px;
  object-fit: cover;
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.composer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.composer-row {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-md);
}

.composer textarea {
  flex: 1;
  min-height: 44px;
  max-height: 130px;
  padding: 11px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: 0;
  resize: vertical;
  color: var(--color-text);
  background: var(--color-background);
}

.composer textarea:focus {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.hidden-file {
  display: none;
}

.image-draft {
  position: relative;
  width: 120px;
  margin-bottom: var(--spacing-md);
}

.image-draft img {
  width: 120px;
  height: 86px;
  border-radius: 6px;
  object-fit: cover;
}

.image-draft button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  color: white;
}

@media (max-width: 900px) {
  .messages-shell {
    grid-template-columns: 1fr;
    height: calc(100dvh - 164px);
    min-height: 520px;
  }

  .conversations-panel {
    min-height: 0;
    max-height: none;
    border-left: 0;
  }

  .chat-panel {
    display: none;
    min-height: 0;
  }

  .messages-shell--chat-open .conversations-panel {
    display: none;
  }

  .messages-shell--chat-open .chat-panel {
    display: flex;
  }

  .chat-header {
    justify-content: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .mobile-back-btn {
    display: inline-flex;
  }
}

@media (max-width: 600px) {
  .messages-shell {
    border-radius: var(--radius-md);
    height: calc(100dvh - 146px);
    min-height: 500px;
  }

  .thread-body {
    padding: var(--spacing-lg) var(--spacing-md);
  }

  .message-bubble {
    max-width: 86%;
  }

  .composer {
    padding: var(--spacing-md);
  }

  .composer-row {
    gap: var(--spacing-sm);
  }
}
</style>
