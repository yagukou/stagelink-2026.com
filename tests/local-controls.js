(() => {
  const panel=document.createElement('aside');
  panel.style.cssText='position:relative;z-index:100;background:#fff4d6;border-bottom:2px solid #8b1a2f;padding:12px;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  panel.innerHTML='<strong>ローカル専用・本番通信なし</strong><span>A/B/C: パスワード test</span>';
  function button(label,action){const b=document.createElement('button');b.textContent=label;b.className='btn-secondary';b.onclick=action;panel.appendChild(b);}
  for(const id of ['a','b','c'])button(id.toUpperCase()+'でログイン',async()=>{
    handleLogout();document.getElementById('login-email').value=id+'@local.test';document.getElementById('login-password').value='test';await handleLogin();showPage('mypage');
  });
  button('ログアウト',()=>{handleLogout();showPage('mypage');});
  button('C → A 受信を追加',()=>{localMock.receive('c','a');alert('追加しました。Aでチャットを開いていると約5秒後に更新されます。');});
  button('次の保存を失敗させる',()=>{localMock.failNext=true;alert('次のDB更新が一度だけ失敗します。');});
  button('保存を2秒遅延',()=>{localMock.delay=2000;});
  button('初期データへ戻す',()=>{if(confirm('ローカル確認データだけをリセットしますか？'))localMock.reset();});
  document.body.prepend(panel);
})();
