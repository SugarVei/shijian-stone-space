import {useState} from 'react';
import {Sparkles,Settings2,X,Trash2,LoaderCircle,Check,ShieldCheck,KeyRound,ChevronLeft,Folder,ArrowUpRight,Info} from 'lucide-react';
import {formatBytes} from './data';
import {desktop} from './useDiskData';
function APISettings({cleanup}){
  const [key,setKey]=useState(''),[model,setModel]=useState(cleanup.config.model),[persist,setPersist]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function save(event){event.preventDefault();setSaving(true);setError('');try{await cleanup.save({apiKey:key,model,persist});setKey('');}catch(error){setError(error.message);}finally{setSaving(false);}}
  return <div className="api-settings"><button className="settings-back" onClick={()=>cleanup.setSettingsOpen(false)}><ChevronLeft size={17}/>API 设置</button>
    {!desktop?<div className="preview-settings"><KeyRound size={30}/><h3>在桌面版连接 DeepSeek</h3><p>网站使用演示结果，不接收或保存 API 密钥。</p><button className="primary-action" onClick={()=>cleanup.setSettingsOpen(false)}>返回预览</button></div>:<form onSubmit={save}>
      <div className="provider-name"><span className="deepseek-dot"/>DeepSeek<span className={cleanup.config.configured?'configured-label':'unconfigured-label'}>{cleanup.config.configured?'已连接':'未配置'}</span></div>
      <label>API Key<input aria-label="DeepSeek API Key" type="password" autoComplete="off" spellCheck="false" value={key} onChange={event=>setKey(event.target.value)} placeholder={cleanup.config.configured?'已保存，留空保持原密钥':'输入 DeepSeek API Key'} required={!cleanup.config.configured}/></label>
      <label>模型<select aria-label="DeepSeek 模型" value={model} onChange={event=>setModel(event.target.value)}><option value="deepseek-flash">DeepSeek Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label>
      <label className="persist-key"><input type="checkbox" checked={persist} onChange={event=>setPersist(event.target.checked)}/>加密保存在此电脑</label>
      <p className="settings-note">密钥仅保存在本机，通过 Windows 加密保护。</p>
      {error&&<p className="cleanup-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit" disabled={saving}>{saving?<LoaderCircle size={16} className="spin"/>:<ShieldCheck size={17}/>}保存设置</button>
    </form>}
  </div>;
}
export default function CleanupPanel({cleanup,scanBusy,onInspect}){
  if(!cleanup.open)return null;
  const candidates=(cleanup.report?.results||[]).filter(item=>item.status==='candidate');
  const reviews=(cleanup.report?.results||[]).filter(item=>item.status==='review');
  const visible=candidates.filter(item=>!cleanup.ownerFilter||item.ownerId===cleanup.ownerFilter);
  const bytes=candidates.reduce((sum,item)=>sum+item.bytes,0),selectedBytes=cleanup.selectedItems.reduce((sum,item)=>sum+item.bytes,0);
  return <aside className="cleanup-drawer" aria-label="AI 清理面板">
    <div className="cleanup-heading"><h2><Sparkles size={21}/>AI 清理</h2><div><button aria-label="API 设置" title="API 设置" onClick={()=>cleanup.setSettingsOpen(!cleanup.settingsOpen)}><Settings2 size={19}/></button><button aria-label="关闭 AI 清理" onClick={cleanup.close}><X size={21}/></button></div></div>
    {cleanup.settingsOpen?<APISettings cleanup={cleanup}/>:<>
      <div className="cleanup-content"><div className="cleanup-provider"><span><span className="deepseek-dot"/>DeepSeek</span><span className="cleanup-mode">{desktop?(cleanup.config.configured?'已连接':'待配置'):'演示'}</span></div>
      {cleanup.report?<>
        <div className="cleanup-summary"><strong>{formatBytes(bytes)}</strong><span>{candidates.length} 项建议清理</span></div>
        {cleanup.ownerFilter&&<button className="filter-reset" onClick={()=>cleanup.setOwnerFilter(null)}><ChevronLeft size={14}/>全部建议</button>}
        <div className="cleanup-results">{visible.map(item=><label className={`cleanup-result ${cleanup.checked.has(item.id)?'checked':''}`} key={item.id}>
          <input type="checkbox" aria-label={`选择 ${item.relativePath}`} checked={cleanup.checked.has(item.id)} onChange={()=>cleanup.toggle(item.id)}/><span className="cleanup-result-body"><span className="result-file-name"><b title={item.relativePath}>{item.relativePath.split(/[\\/]/).pop()}</b><strong>{formatBytes(item.bytes)}</strong></span><span className="result-path" title={item.relativePath}>{item.relativePath}</span><span className="result-reason">{item.reason}</span></span><button className="inspect-candidate" aria-label={`定位 ${item.relativePath}`} title="定位石头" type="button" onClick={event=>{event.preventDefault();onInspect(item.ownerId);}}><ArrowUpRight size={15}/></button>
        </label>)}</div>
        {!candidates.length&&<div className="cleanup-empty"><ShieldCheck size={35}/><h3>未发现建议清理的文件</h3><p>当前结果会保留用途不明确的文件。</p></div>}
        {reviews.length>0&&<details className="cleanup-reviews"><summary>{reviews.length} 项需要进一步核实</summary>{reviews.map(item=><div key={item.id}><b>{item.relativePath}</b><p>{item.reason}</p></div>)}</details>}
        <p className="analysis-scope">{cleanup.report.basedOnCachedScan?'基于缓存，已重新核验候选文件':'检查了 '+cleanup.report.checkedFiles.toLocaleString()+' 个文件'}{cleanup.report.limited?' · 本次仅分析前 160 个候选，请进入子文件夹继续':''}{cleanup.report.skipped?` · ${cleanup.report.skipped} 项无权读取`:''}</p>
      </>:<div className="cleanup-empty">{cleanup.analyzing?<><LoaderCircle size={39} className="spin"/><h3>正在分析</h3><p>DeepSeek 正在审核清理候选项</p></>:<><Sparkles size={38}/><h3>找出可以释放的空间</h3><p>旧缓存、临时文件和历史日志</p></>}</div>}
      {cleanup.error&&<div className="cleanup-error" role="alert">{cleanup.error}</div>}{cleanup.message&&<div className="cleanup-message" role="status"><Check size={16}/>{cleanup.message}</div>}
      </div>
      <div className="cleanup-footer">
        {cleanup.report&&candidates.length>0&&<><div className="cleanup-selection"><span>已选 {cleanup.selectedItems.length} 项</span><strong>{formatBytes(selectedBytes)}</strong></div><button className="trash-action" onClick={cleanup.trash} disabled={!cleanup.selectedItems.length||cleanup.trashing}>{cleanup.trashing?<LoaderCircle size={17} className="spin"/>:<Trash2 size={17}/>}移入回收站</button><p className="cleanup-caution">AI 建议供参考，请确认所选文件已不再需要。</p></>}
        <button className="primary-action analyze-action" onClick={cleanup.analyzing?cleanup.cancel:cleanup.analyze} disabled={scanBusy||cleanup.trashing}>{cleanup.analyzing?<X size={17}/>:<Sparkles size={17}/>} {cleanup.analyzing?'取消分析':cleanup.report?'重新分析':desktop?'开始分析':'演示分析'}</button>
        {!cleanup.report&&<p className="cleanup-privacy">{desktop?'仅发送相对路径、大小和修改时间，不上传文件内容。':'示例数据，不会操作本机文件。'}</p>}
      </div>
    </>}
    {cleanup.confirmPreview&&<div className="preview-confirm" role="alertdialog" aria-label="确认演示清理"><Trash2 size={28}/><h3>确认清理所选 {cleanup.selectedItems.length} 项？</h3><p>这是界面演示，不会删除本机文件。</p><div><button onClick={()=>cleanup.setConfirmPreview(false)}>取消</button><button className="trash-action" onClick={cleanup.trash}>确认演示</button></div></div>}
  </aside>;
}
