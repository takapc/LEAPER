import { useState } from 'react'
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Textarea,
  VStack,
  Text,
  Alert,
  AlertIcon,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
} from '@chakra-ui/react'
import { parseWordDataFromHTML, saveWordDataToLocalStorage } from '../utils/wordData'

/**
 * データを手動でインポートするコンポーネント
 */
export function DataImporter({ onDataImported }) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [importData, setImportData] = useState('')
  const [importType, setImportType] = useState('json') // 'json' or 'html'
  const toast = useToast()

  // JSONファイルを読み込む
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result)
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          handleImportData(jsonData)
        } else {
          toast({
            title: 'エラー',
            description: '無効なJSON形式です。配列形式のデータを入力してください。',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
        }
      } catch (error) {
        toast({
          title: 'エラー',
          description: 'JSONファイルの読み込みに失敗しました',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    }
    reader.readAsText(file)
  }

  // データをインポートする共通処理
  const handleImportData = (words) => {
    if (!words || words.length === 0) {
      toast({
        title: 'エラー',
        description: 'データが空です',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    saveWordDataToLocalStorage(words)
    
    toast({
      title: '成功',
      description: `${words.length}語のデータをインポートしました`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })

    onDataImported(words)
    onClose()
    setImportData('')
  }

  // テキストエリアからのインポート
  const handleImport = () => {
    try {
      if (!importData.trim()) {
        toast({
          title: 'エラー',
          description: 'データを入力してください',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      let words = []

      if (importType === 'json') {
        // JSON形式として解析
        try {
          const parsed = JSON.parse(importData)
          if (Array.isArray(parsed)) {
            words = parsed
          } else {
            throw new Error('配列形式ではありません')
          }
        } catch (jsonError) {
          toast({
            title: 'エラー',
            description: 'JSON形式が正しくありません',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
          return
        }
      } else {
        // HTML形式として解析
        words = parseWordDataFromHTML(importData)
      }
      
      if (words.length === 0) {
        toast({
          title: 'エラー',
          description: `データの解析に失敗しました。正しい${importType === 'json' ? 'JSON' : 'HTML'}形式を入力してください。`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      handleImportData(words)
    } catch (error) {
      console.error('インポートエラー:', error)
      toast({
        title: 'エラー',
        description: 'データのインポートに失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <>
      <Button onClick={onOpen} size="sm" variant="outline">
        データをインポート
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>単語データをインポート</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Tabs onChange={(index) => setImportType(index === 0 ? 'json' : 'html')}>
              <TabList>
                <Tab>JSONファイル</Tab>
                <Tab>HTML/テキスト</Tab>
              </TabList>

              <TabPanels>
                {/* JSONファイルタブ */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Alert status="info">
                      <AlertIcon />
                      <Text fontSize="sm">
                        JSONファイルを選択するか、JSON形式のテキストを貼り付けてください。
                        <br />
                        形式: [{"{"}"id": 1, "word": "agree", "meaning": "..."{"}"}, ...]
                      </Text>
                    </Alert>

                    <Box>
                      <Text fontSize="sm" mb={2}>ファイルを選択:</Text>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        style={{ width: '100%' }}
                      />
                    </Box>

                    <Text fontSize="sm" textAlign="center" color="gray.500">
                      または
                    </Text>

                    <Textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder='[{"id": 1, "word": "agree", "meaning": "..."}, ...]'
                      rows={10}
                      fontFamily="mono"
                      fontSize="xs"
                    />

                    <Button onClick={handleImport} colorScheme="blue" width="full">
                      JSONをインポート
                    </Button>
                  </VStack>
                </TabPanel>

                {/* HTML/テキストタブ */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Alert status="info">
                      <AlertIcon />
                      <Text fontSize="sm">
                        LEAP改訂版のページのHTMLをコピー&ペーストしてください。
                        <br />
                        または、テーブル部分のHTMLを貼り付けてください。
                      </Text>
                    </Alert>
                    
                    <Textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="HTMLデータをここに貼り付けてください..."
                      rows={10}
                      fontFamily="mono"
                      fontSize="xs"
                    />

                    <Button onClick={handleImport} colorScheme="blue" width="full">
                      HTMLをインポート
                    </Button>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

