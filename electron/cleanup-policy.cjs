const path = require('node:path');
const DAY = 86400000;
const PROTECTED_PARTS = /(^|[\\/])(windows|program files(?: \(x86\))?|programdata|system volume information|\$recycle\.bin|recovery|efi|boot|\.git|\.ssh|\.gnupg)([\\/]|$)/i;
const SECRET = /(^|[\\/])(\.env(?:\..*)?|credentials(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|pfx|p12|kdbx))$/i;
function cleanupPolicy(filePath, stat, now = Date.now()) {
  if (PROTECTED_PARTS.test(filePath) || SECRET.test(filePath)) return { eligible:false,reason:'受保护目录或凭据文件' };
  if (stat.isSymbolicLink?.() || (stat.nlink || 1)>1) return { eligible:false,reason:'链接文件不参与清理' };
  if (stat.isDirectory?.()) return { eligible:false,reason:'仅逐个检查文件，不整目录删除' };
  const ageDays = (now-stat.mtimeMs)/DAY;
  if (!Number.isFinite(ageDays) || ageDays < 7) return { eligible:false,reason:'最近七天修改过，暂时保留' };
  const extension = path.extname(filePath).toLowerCase();
  const reasons={'.tmp':'七天未修改的临时文件','.temp':'七天未修改的临时文件','.log':'历史日志，可在确认不再排错后清理','.dmp':'历史转储文件，可在确认不再排错后清理','.etl':'历史跟踪日志，可在确认不再排错后清理','.cache':'历史缓存文件，需确认应用可重新生成','.crdownload':'长时间未更新的未完成下载'};
  if (!reasons[extension]) return { eligible:false,reason:'不能仅凭名称判断用途，保留' };
  return { eligible:true,reason:reasons[extension],ageDays:Math.floor(ageDays) };
}
function sameSnapshot(stat, saved) {
  return stat.isFile() && !stat.isSymbolicLink() && stat.size===saved.bytes && stat.mtimeMs===saved.mtimeMs && String(stat.ino)===String(saved.ino) && String(stat.dev)===String(saved.dev);
}
module.exports={cleanupPolicy,sameSnapshot};
