self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of clientsList) {
      const clientUrl = new URL(client.url)
      const nextUrl = new URL(targetUrl, self.location.origin)

      if (clientUrl.origin === nextUrl.origin && 'focus' in client) {
        if ('navigate' in client) await client.navigate(nextUrl.href)
        return client.focus()
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl)
    }
  })())
})
