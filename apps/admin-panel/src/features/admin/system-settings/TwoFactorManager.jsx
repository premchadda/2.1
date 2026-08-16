import { useState, useEffect } from 'react'
import { KeyRound, QrCode, Copy, RefreshCw, ShieldCheck, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'
import { authAPI } from '../../../shared/lib/dataService.js'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../../../shared/components/common/ConfirmModal'

export default function TwoFactorManager() {
  const [status, setStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [enrollment, setEnrollment] = useState(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [verifyToken, setVerifyToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true)
      const response = await authAPI.twoFactorStatus()
      setStatus(response.data.data)
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    let active = true
    if (enrollment?.otpauthUri) {
      QRCode.toDataURL(enrollment.otpauthUri, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
        .then((url) => {
          if (active) setQrCodeDataUrl(url)
        })
        .catch((err) => {
          console.error('Failed to generate local 2FA QR code:', err)
        })
    } else {
      setQrCodeDataUrl('')
    }
    return () => {
      active = false
    }
  }, [enrollment?.otpauthUri])

  const handleEnroll = async () => {
    try {
      setEnrolling(true)
      const response = await authAPI.twoFactorEnroll()
      const data = response.data.data
      setEnrollment(data)
      setShowBackupCodes(true)
      toast.success('Scan the QR code with your authenticator app')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start 2FA enrollment')
    } finally {
      setEnrolling(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!verifyToken.trim()) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    try {
      setVerifying(true)
      await authAPI.twoFactorVerify(verifyToken.trim())
      toast.success('Two-factor authentication enabled')
      setEnrollment(null)
      setVerifyToken('')
      setShowBackupCodes(false)
      fetchStatus()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code')
    } finally {
      setVerifying(false)
    }
  }

  const handleRegenerate = async () => {
    const confirmed = await confirm({ title: 'Confirm', message: 'Regenerating backup codes invalidates all previous ones. Continue?' })
    if (!confirmed) return
    try {
      setRegenerating(true)
      const response = await authAPI.twoFactorRegenerateBackupCodes()
      const codes = response.data.data.backupCodes
      setEnrollment((prev) => (prev ? { ...prev, backupCodes: codes } : prev))
      setShowBackupCodes(true)
      toast.success('New backup codes generated. Save them now — old codes no longer work.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to regenerate backup codes')
    } finally {
      setRegenerating(false)
    }
  }

  const handleDisable = async () => {
    const confirmed = await confirm({ title: 'Confirm', message: 'Disable two-factor authentication for this account?' })
    if (!confirmed) return
    try {
      setDisabling(true)
      await authAPI.twoFactorDisable()
      toast.success('Two-factor authentication disabled')
      setEnrollment(null)
      setShowBackupCodes(false)
      fetchStatus()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable 2FA')
    } finally {
      setDisabling(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking 2FA status...
      </div>
    )
  }

  const enabled = status?.enabled === true

  return (
    <div className="space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <ShieldCheck className={`w-5 h-5 ${enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
        <p className="font-medium text-gray-900 dark:text-white">
          {enabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is not set up'}
        </p>
      </div>

      {enabled ? (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 text-sm"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate backup codes
          </button>
          <button
            onClick={handleDisable}
            disabled={disabling}
            className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:bg-red-900/20 disabled:opacity-50 text-sm"
          >
            {disabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Disable 2FA
          </button>
        </div>
      ) : !enrollment ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enroll to require a one-time code from an authenticator app (e.g. Google Authenticator, Authy) when signing in.
          </p>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Start enrollment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg min-h-[200px]">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="2FA QR code"
                  className="w-40 h-40 rounded bg-white p-1.5 shadow-sm"
                />
              ) : (
                <div className="w-40 h-40 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-2" />
                  <span className="text-xs text-gray-500">Generating QR...</span>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Scan with your authenticator app</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Manual secret</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono break-all">
                    {enrollment.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(enrollment.secret)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300"
                    aria-label="Copy secret"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <a
                href={enrollment.otpauthUri}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <ExternalLink className="w-3 h-3" />
                Open in authenticator app
              </a>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter verification code</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify &amp; enable
              </button>
            </div>
          </form>

          {showBackupCodes && enrollment.backupCodes?.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium text-amber-800">Save these backup codes now</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                Each code can be used once if you lose access to your authenticator device.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {enrollment.backupCodes.map((code) => (
                  <code key={code} className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded font-mono tracking-wider">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}