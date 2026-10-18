import { useEffect, useState } from 'react'
import { Alert, AlertIcon, Box, Button, FormControl, FormLabel, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { browserSyncClient } from '../utils/browserSync.js'
import { parseAdminCommand } from '../utils/adminCommand.js'
import { getTotalQuizCountFromLocalStorage } from '../utils/learningStats.js'

export function AdminSettings() {
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [auth, setAuth] = useState(null)
  const [command, setCommand] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!auth) return undefined
    const timer = setTimeout(() => {
      setAuth(null)
      setConfirmation(null)
      setError('管理者モードの有効期限が切れました。もう一度認証してください。')
      setMessage('')
    }, Math.max(0, auth.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [auth])
  const perform = async (operation) => {
    setBusy(true)
    setError('')
    setMessage('')
    try { await operation() } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return (
    <Stack spacing={3} borderTopWidth="1px" pt={4}>
      <Button variant="ghost" justifyContent="space-between" minH="44px" aria-expanded={expanded} aria-controls="admin-settings" isDisabled={busy} onClick={() => {
        setExpanded(!expanded)
        setPassword('')
        setAuth(null)
        setConfirmation(null)
        setCommand('')
        setError('')
        setMessage('')
      }}>管理者モード<Text as="span" aria-hidden="true">{expanded ? '−' : '＋'}</Text></Button>
      {expanded && <Stack id="admin-settings" spacing={4}>
        {error && <Alert status="error" fontSize="sm" borderRadius="md"><AlertIcon />{error}</Alert>}
        {message && <Alert status="success" fontSize="sm" borderRadius="md"><AlertIcon />{message}</Alert>}
        {!auth ? (
          <Box as="form" onSubmit={(event) => {
            event.preventDefault()
            perform(async () => {
              try { setAuth(await browserSyncClient.authenticateAdmin(password)) } finally { setPassword('') }
            })
          }}>
            <FormControl>
              <FormLabel htmlFor="admin-password" fontSize="sm">管理者パスワード</FormLabel>
              <Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={1024} minH="44px" />
            </FormControl>
            <Button mt={3} type="submit" colorScheme="teal" variant="outline" w="full" minH="44px" isLoading={busy} isDisabled={!password}>管理者モードを開く</Button>
          </Box>
        ) : <>
          <Text fontSize="sm" color="gray.600">認証は15分間有効です。累計の変更は連携中のブラウザにも反映されます。</Text>
          <Box as="form" onSubmit={(event) => {
            event.preventDefault()
            setError('')
            setMessage('')
            try {
              const { count } = parseAdminCommand(command)
              setConfirmation({ count, before: getTotalQuizCountFromLocalStorage() })
            } catch (failure) { setError(failure.message) }
          }}>
            <FormControl>
              <FormLabel htmlFor="admin-command" fontSize="sm">コマンド</FormLabel>
              <Input id="admin-command" fontFamily="mono" value={command} onChange={(event) => { setCommand(event.target.value); setConfirmation(null) }} placeholder="set-total 12345" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} minH="44px" isDisabled={busy} />
            </FormControl>
            <Text fontSize="xs" color="gray.600" mt={2}>set-total 数値：あなたの累計を指定した語数に変更します。0以上の整数を指定できます。「みんなの累計」と学習履歴は変わりません。</Text>
            <Button mt={3} type="submit" variant="outline" minH="44px" w="full" isDisabled={busy || !command.trim()}>変更内容を確認</Button>
          </Box>
          {confirmation && <Box borderWidth="1px" borderColor="orange.200" borderRadius="md" p={3}>
            <Text fontSize="sm">あなたの累計を {confirmation.before.toLocaleString()}語 → {confirmation.count.toLocaleString()}語 に変更しますか？</Text>
            <HStack mt={3} justify="flex-end" flexWrap="wrap">
              <Button autoFocus minH="44px" size="sm" isDisabled={busy} onClick={() => setConfirmation(null)}>キャンセル</Button>
              <Button minH="44px" size="sm" colorScheme="orange" isLoading={busy} onClick={() => perform(async () => {
                await browserSyncClient.setTotalCount(command, auth.session)
                setConfirmation(null)
                setCommand('')
                setMessage(browserSyncClient.getStatus().linked ? '累計を変更しました。連携先にも同期されます。' : '累計を変更しました。')
              })}>累計を変更する</Button>
            </HStack>
          </Box>}
        </>}
      </Stack>}
    </Stack>
  )
}
