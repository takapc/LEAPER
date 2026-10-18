import { useEffect, useState } from 'react'
import { Alert, AlertIcon, Badge, Box, Button, FormControl, FormLabel, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { browserSyncClient } from '../utils/browserSync.js'

export function BrowserSyncSettings() {
  const [status, setStatus] = useState(() => browserSyncClient.getStatus())
  const [invite, setInvite] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => browserSyncClient.subscribe(setStatus), [])
  useEffect(() => {
    if (!invite) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [invite])
  const remaining = invite ? Math.max(0, Math.ceil((invite.expiresAt - now) / 1000)) : 0
  const perform = async (operation) => {
    setBusy(true)
    setError('')
    setMessage('')
    try { await operation() } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const issue = () => perform(async () => {
    const result = await browserSyncClient.issueCode()
    setNow(Date.now())
    setInvite(result)
  })
  return (
    <Stack spacing={4} borderTopWidth="1px" pt={5}>
      <Box>
        <HStack justify="space-between">
          <Text fontWeight="bold">ブラウザ間の連携</Text>
          {status.linked && <Badge colorScheme="teal">連携中</Badge>}
        </HStack>
        <Text mt={2} fontSize="sm" color="gray.600">
          アカウントなしで、学習履歴・間違いマーク・累計・出題条件をほかのブラウザと自動同期します。
        </Text>
      </Box>
      {(error || status.error) && <Alert status="warning" fontSize="sm" borderRadius="md"><AlertIcon />{error || status.error}</Alert>}
      {message && <Alert status="success" fontSize="sm" borderRadius="md"><AlertIcon />{message}</Alert>}
      {status.linked && (
        <Box>
          <Text fontSize="sm" role="status">
            {status.state === 'syncing' ? '同期しています…' : status.state === 'error' ? '未同期の変更はこのブラウザに残っています。' : '連携したブラウザを開いている間、自動で同期します。'}
          </Text>
          {status.lastSync && <Text fontSize="xs" color="gray.600" mt={1}>最終同期 {new Date(status.lastSync).toLocaleTimeString('ja-JP')}</Text>}
          <Button mt={2} size="sm" minH="44px" variant="outline" onClick={() => perform(() => browserSyncClient.sync())} isLoading={status.state === 'syncing'} isDisabled={busy}>
            今すぐ同期
          </Button>
        </Box>
      )}
      <Button onClick={issue} isLoading={busy} isDisabled={confirmDisconnect} colorScheme="teal" variant={status.linked ? 'outline' : 'solid'} minH="44px" whiteSpace="normal" h="auto" py={3}>
        {status.linked ? '別のブラウザ用のコードを発行' : 'このブラウザでコードを発行'}
      </Button>
      {invite && (
        <Box bg="teal.50" p={4} borderRadius="md">
          <FormControl>
            <FormLabel htmlFor="browser-invite" fontSize="sm">別のブラウザで入力するコード</FormLabel>
            <Input id="browser-invite" value={invite.code} isReadOnly bg="white" fontFamily="mono" fontWeight="bold" fontSize={{ base: 'md', sm: 'lg' }} textAlign="center" onFocus={(event) => event.target.select()} />
          </FormControl>
          <HStack mt={2} justify="space-between" flexWrap="wrap">
            <Text fontSize="sm" color={remaining ? 'teal.800' : 'red.700'}>
              {remaining ? `残り ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}・1回限り` : '有効期限が切れました'}
            </Text>
            <Button size="sm" minH="44px" variant="ghost" isDisabled={!remaining} onClick={() => perform(async () => {
              try { await navigator.clipboard.writeText(invite.code); setMessage('コードをコピーしました。') } catch { throw new Error('コードを選択してコピーしてください。') }
            })}>コピー</Button>
          </HStack>
          <Text fontSize="xs" color="gray.600" mt={2}>つなぎたいブラウザの「設定」で、このコードを入力してください。新しいコードを発行すると、前のコードは使えなくなります。</Text>
        </Box>
      )}
      {!status.linked && (
        <Box as="form" onSubmit={(event) => {
          event.preventDefault()
          perform(async () => {
            await browserSyncClient.join(code)
            setCode('')
            setMessage('連携しました。これから自動で同期します。')
          })
        }}>
          <FormControl>
            <FormLabel htmlFor="browser-code" fontSize="sm">別のブラウザで発行したコード</FormLabel>
            <Input id="browser-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD-1234-EF56" maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} fontFamily="mono" />
          </FormControl>
          <Text fontSize="xs" color="gray.600" mt={2}>発行元の設定を引き継ぎ、履歴と間違いマークをまとめます。初回の累計は両方の語数を合算します。解除後につなぎ直す場合も合算されます。</Text>
          <Button type="submit" mt={3} w="full" colorScheme="teal" variant="outline" isLoading={busy} isDisabled={code.replace(/[\s-]/g, '').length !== 12} minH="44px">コードで連携する</Button>
        </Box>
      )}
      {status.linked && (confirmDisconnect ? (
        <Box p={3} borderWidth="1px" borderColor="red.200" borderRadius="md">
          <Text fontSize="sm">このブラウザの連携を解除しますか？手元の学習データと、ほかのブラウザの連携は残ります。</Text>
          <HStack mt={3} justify="flex-end">
            <Button autoFocus size="sm" minH="44px" onClick={() => setConfirmDisconnect(false)}>キャンセル</Button>
            <Button colorScheme="red" size="sm" minH="44px" onClick={() => {
              browserSyncClient.disconnect()
              setInvite(null)
              setConfirmDisconnect(false)
              setError('')
              setMessage('このブラウザの連携を解除しました。')
            }}>解除する</Button>
          </HStack>
        </Box>
      ) : (
        <Button onClick={() => setConfirmDisconnect(true)} isDisabled={busy} variant="ghost" colorScheme="red" size="sm" minH="44px" alignSelf="flex-start">このブラウザの連携を解除</Button>
      ))}
      <Text fontSize="xs" color="gray.600">連携情報はブラウザに保存されます。ブラウザのデータを消した場合は、別の連携済みブラウザからコードを発行し直してください。</Text>
    </Stack>
  )
}
