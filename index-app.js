
/* Compatibility shim: old local-user collector removed after Supabase migration. */
if (typeof window.collectLocalUsersForWorkspace !== 'function') {
  window.collectLocalUsersForWorkspace = function(){
    return [];
  };
}
if (typeof collectLocalUsersForWorkspace !== 'function') {
  var collectLocalUsersForWorkspace = function(){
    return [];
  };
}

/* Firebase disabled: Supabase is the single cloud source for schools/users. */
window.db = null;
window.auth = { currentUser: { uid: localStorage.getItem('cached_manager_uid') || 'offline-admin' } };
window.appId = 'smart-school-supabase';
window.currentUserUid = window.auth.currentUser.uid;
window.fs = {
  doc:function(){return null;}, setDoc:async function(){return null;}, getDoc:async function(){return null;},
  updateDoc:async function(){return null;}, collection:function(){return null;}, onSnapshot:function(){return function(){};},
  query:function(){return null;}, addDoc:async function(){return null;}, deleteDoc:async function(){return null;}
};
window.ensureAuth = async function(){ return window.auth.currentUser; };
setTimeout(function(){ window.dispatchEvent(new CustomEvent('authReady')); }, 0);

;

/* extracted inline script 2 */

        let allUsers = [];
        let allNotifications = [];
        let currentUser = null;
        let isManagerVerifiedInSession = false;

        const showToast = (msg) => {
            const container = document.getElementById('toast-container');
            const t = document.createElement('div');
            t.className = 'toast shadow-xl';
            t.innerText = msg;
            container.appendChild(t);
            setTimeout(() => t.remove(), 3000);
        };

        const isManagerAccount = (name, email) => {
            const n = (name || "").toLowerCase().trim();
            const e = (email || "").toLowerCase().trim();
            // التعرف على الحساب كمدير بناءً على الكلمات المفتاحية أو البريد المرتبط (a123456)
            const isMatch = n === 'admin' || e === 'admin' || e.includes('a123456') || n === 'مدير' || localStorage.getItem('is_admin_session') === 'true';
            if (isMatch) {
                localStorage.setItem('is_admin_session', 'true');
                localStorage.setItem('admin_verified', 'true');
            }
            return isMatch;
        };

        const openRegistrationModal = () => { closeModal('registration-modal'); document.getElementById('registration-modal').style.display = 'flex'; };
        const openSchoolRequestModal = () => { closeModal('school-request-modal'); document.getElementById('school-request-modal').style.display = 'flex'; };
        const openAddUserModal = () => { openEditModal('user-'+Date.now(), '', '', 'performance'); };

        const makeSchoolId = (schoolName, email) => {
            const base = String(schoolName || email || 'school').replace(/[^a-zA-Z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'school';
            return 'SCH-' + base + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
        };

        const submitSchoolRequest = async () => {
            const schoolName = document.getElementById('school-req-school-name').value.trim();
            const managerName = document.getElementById('school-req-manager-name').value.trim();
            const email = document.getElementById('school-req-email').value.trim();
            const password = document.getElementById('school-req-password').value.trim();
            if (!schoolName || !managerName || !email || !password) { showToast('يرجى تعبئة اسم المدرسة واسم المدير والبريد والرقم السري'); return; }
            try {
                if (!window.SmartSchoolSupabase || !window.SmartSchoolSupabase.createSchoolWithManager) throw new Error('جسر Supabase غير جاهز');
                const result = await window.SmartSchoolSupabase.createSchoolWithManager({ schoolName, managerName, email, password, status: 'active' });
                const school = result.school;
                const manager = result.manager;
                const localUsers = collectLocalUsersForWorkspace();
                if (!localUsers.some(u => String(u.email||'').toLowerCase() === String(email).toLowerCase())) {
                    localUsers.push({ ...manager, role:'leadership', isActive:true, status:'active', schoolName:school.schoolName, schoolId:school.id, accountType:'school_manager', isPrimaryManager:true });
                   
                    allUsers = localUsers;
                }
                const localSchools = JSON.parse(localStorage.getItem('smart_school_schools') || '[]').filter(s => String(s.id||s.schoolId) !== String(school.id));
                localSchools.push({ id:school.id, schoolId:school.id, schoolName:school.schoolName, managerName:school.managerName, managerEmail:school.managerEmail, status:school.status, registrationLink:school.registrationLink, loginLink:school.loginLink, createdAt:school.createdAt });
                localStorage.setItem('smart_school_schools', JSON.stringify(localSchools));
                closeModal('school-request-modal');
                showToast('تم إنشاء المدرسة وحفظها في Supabase بنجاح');
                if (document.getElementById('school-management-modal') && document.getElementById('school-management-modal').style.display === 'flex') renderSchoolManagement();
            } catch (err) {
                console.error('Supabase school create failed:', err);
                showToast('فشل حفظ المدرسة في Supabase: ' + (err.message || err));
            }
        };

        const submitRegistrationRequest = async () => {
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const role = document.getElementById('reg-role').value;
            const phone = document.getElementById('reg-phone').value.trim();
            const nationalId = document.getElementById('reg-national-id').value.trim();
            const schoolName = document.getElementById('reg-school-name').value.trim() || (window.pendingRegistrationInvite?.schoolName || '');
            const schoolId = document.getElementById('reg-school-id').value.trim() || (window.pendingRegistrationInvite?.schoolId || '');
            const urlParams = new URLSearchParams(window.location.search);
            const inviteAdminId = urlParams.get('admin') || window.pendingRegistrationInvite?.admin || '';
            const inviteToken = urlParams.get('token') || window.pendingRegistrationInvite?.token || '';
            if (!name || !email || !password || !role) { showToast("يرجى تعبئة الاسم وبريد منصة مدرستي والرقم السري والدور"); return; }
            if (!inviteAdminId || !inviteToken) { showToast("رابط التسجيل غير صالح أو غير مرتبط بحساب مدير"); return; }
            const requestId = 'reg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const userData = {
                id: requestId,
                name,
                email,
                password,
                loginPassword: password,
                passwordMasked: '••••••',
                role,
                phone,
                nationalId,
                schoolName,
                schoolId,
                isActive: false,
                status: 'pending',
                source: 'registration_link',
                adminOwnerId: inviteAdminId,
                registrationToken: inviteToken,
                registeredViaManagerLink: true,
                dateJoined: new Date().toLocaleString('ar-SA')
            };
            try {
                const allUsers = JSON.parse(localStorage.getItem('smart_school_users') || '[]');
                const emailKey = email.toLowerCase();
                const exists = allUsers.some(u => String(u.email || '').toLowerCase() === emailKey && String(u.adminOwnerId || '') === String(inviteAdminId));
                if (exists) { showToast("يوجد طلب أو حساب سابق بنفس البريد داخل هذه المدرسة"); return; }
                allUsers.push(userData);
                localStorage.setItem('smart_school_users', JSON.stringify(allUsers));
                if (window.db && window.fs) {
                    await window.fs.setDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', requestId), userData, { merge: true });
                }
                closeModal('registration-modal');
                document.getElementById('role-selector-screen').classList.add('login-hidden');
                document.getElementById('role-selector-screen').style.display = 'none';
                document.getElementById('waiting-screen').classList.remove('hidden');
                showToast("تم إرسال طلب التسجيل للمدير/ة للتفعيل");
            } catch (err) {
                console.error(err);
                showToast("تم حفظ الطلب محليًا، وتعذرت المزامنة السحابية مؤقتًا");
            }
        };

        const handleAdminDirectEntry = async () => {
            const n = document.getElementById('user-display-name').value.trim();
            const e = document.getElementById('user-madrasati-email').value.trim();
            
            if (isManagerAccount(n, e)) {
                isManagerVerifiedInSession = true;
                localStorage.setItem('is_admin_session', 'true');
                document.getElementById('waiting-screen').classList.add('hidden');

                const tempAdminData = { id: 'root', name: n || 'مدير النظام', email: e || 'admin', role: 'leadership', isActive: true };
                startApp(tempAdminData);

                try {
                    const user = await window.ensureAuth();
                    if (user) {
                        // حفظ بيانات المدير في المجموعة العامة ليظهر في القائمة
                        await window.fs.setDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', user.uid), { ...tempAdminData, id: user.uid }, {merge:true});
                        currentUser.id = user.uid;
                        localStorage.setItem('cached_manager_uid', user.uid);
                    }
                } catch(err) { console.warn("Background Auth Delayed"); }
            } else {
                if (!n || !e) showToast("يرجى إدخال البيانات");
                else checkUserStatus();
            }
        };

        const handleRoleSelection = async (role) => {
            const n = document.getElementById('user-display-name').value.trim();
            const e = document.getElementById('user-madrasati-email').value.trim();
            if (!n || !e) { showToast("يرجى إدخال البيانات"); return; }
            try {
                const user = await window.ensureAuth();
                const isManager = isManagerAccount(n, e);
                if (isManager) {
                    isManagerVerifiedInSession = true;
                    const userData = { id: user.uid, name: n, email: e, role: 'leadership', isActive: true, isRootAdmin: true };
                    await window.fs.setDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', user.uid), userData, { merge: true });
                    startApp(userData);
                    return;
                }
                showToast("الدخول للأقسام يتم بعد التسجيل من رابط المدير/ة وتفعيل الحساب فقط");
                checkUserStatus();
            } catch(e) { showToast("خطأ في تسجيل البيانات"); }
        };

        const checkUserStatus = async () => {
            try {
                const n = document.getElementById('user-display-name').value.trim();
                const e = document.getElementById('user-madrasati-email').value.trim();
                const isRoot = isManagerVerifiedInSession || isManagerAccount(n, e) || localStorage.getItem('is_admin_session') === 'true';
                
                if (isRoot) {
                    document.getElementById('waiting-screen').classList.add('hidden');
                    startApp({ id: 'root', name: n || 'المدير', email: e || 'admin', role: 'leadership', isActive: true });
                    return;
                }

                const user = await window.ensureAuth();
                if (!user) return;

                window.fs.onSnapshot(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', user.uid), (doc) => {
                    if (doc.exists() && doc.data().isActive) {
                        document.getElementById('waiting-screen').classList.add('hidden');
                        startApp(doc.data());
                    } else {
                        document.getElementById('role-selector-screen').classList.add('login-hidden'); document.getElementById('role-selector-screen').style.display = 'none';
                        document.getElementById('waiting-screen').classList.remove('hidden');
                    }
                });
            } catch(e) {}
        };

        const startApp = (u) => {
            currentUser = u;
            document.getElementById('waiting-screen').classList.add('hidden');
            document.getElementById('role-selector-screen').classList.add('login-hidden'); document.getElementById('role-selector-screen').style.display = 'none';
            document.getElementById('main-ui').classList.remove('opacity-0', 'pointer-events-none');
            document.getElementById('main-ui').style.opacity = '1';
            document.getElementById('main-ui').style.display = 'flex';
            document.getElementById('active-role-badge').innerText = u.role === 'leadership' ? 'مدير النظام' : 'منسوب/ة المدرسة';
            renderGrid(u.role);
            syncCloudData();
            syncNotifications();
        };

        const syncCloudData = () => {
            if (!window.db || !window.auth.currentUser) return;
            window.fs.onSnapshot(window.fs.collection(window.db, 'artifacts', window.appId, 'public', 'data', 'users'), (snap) => {
                allUsers = snap.docs.map(d => d.data());
                saveUnifiedUserStores(allUsers);
                if (document.getElementById('user-management-modal').style.display === 'flex') renderUserTable();
            }, (err) => {
                const backup = localStorage.getItem('offline_users_backup');
                if (backup) {
                    allUsers = JSON.parse(backup);
                    if (document.getElementById('user-management-modal').style.display === 'flex') renderUserTable();
                }
            });
        };

        const syncNotifications = () => {
            if (!window.db) return;
            window.fs.onSnapshot(window.fs.collection(window.db, 'artifacts', window.appId, 'public', 'data', 'notifications'), (snap) => {
                allNotifications = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
                const badge = document.getElementById('bell-badge');
                const visibleCount = allNotifications.filter(canCurrentUserReadNotification).length;
                if (visibleCount > 0) {
                    badge.innerText = visibleCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.innerText = '0';
                    badge.classList.add('hidden');
                }
            });
        };

        const renderGrid = (role) => {
            const grid = document.getElementById('apps-grid');
            if (!grid) return;
            grid.innerHTML = '';
            const apps = role === 'leadership' ? ['leadership', 'agency', 'performance'] : [role];
            apps.forEach(appId => {
                const titles = { 'leadership': '🏛️ قسم مدير النظام', 'agency': '📑 قسم الوكيل/ة', 'performance': '👨‍🏫 قسم المعلم/ة' };
                const card = document.createElement('div');
                card.className = "app-card p-8 text-center cursor-pointer shadow-lg hover:shadow-2xl transition-all hover:scale-105";
                card.innerHTML = `<h2 class="font-bold text-xl text-slate-800">${titles[appId]}</h2><p class="text-[10px] text-teal-600 mt-2 font-bold">نظام نشط ومؤمن ✅</p><button class="mt-6 bg-teal-700 text-white px-6 py-2 rounded-xl w-full font-bold shadow-md">دخول</button>`;
                card.onclick = () => launchApp(appId);
                grid.appendChild(card);
            });
            if (role === 'leadership') {
                const schoolCard = document.createElement('div');
                schoolCard.className = "app-card p-8 text-center cursor-pointer shadow-lg hover:shadow-2xl transition-all hover:scale-105";
                schoolCard.innerHTML = `<h2 class="font-bold text-xl text-slate-800">🏫 إدارة المدارس</h2><p class="text-[10px] text-teal-600 mt-2 font-bold">إنشاء المدارس وربط المديرين والروابط المستقلة</p><button class="mt-6 bg-teal-700 text-white px-6 py-2 rounded-xl w-full font-bold shadow-md">فتح الإدارة</button>`;
                schoolCard.onclick = () => showSchoolManagementPanel();
                grid.appendChild(schoolCard);
            }
        };

        const launchApp = (appId) => {
            const files = { 'leadership': 'manager.html', 'agency': 'agent.html', 'performance': 'teacher.html' };
            const target = files[appId];
            if (!target) return showToast('لم يتم العثور على ملف القسم');
            try {
                localStorage.setItem('currentRole', currentUser?.role || appId);
                localStorage.setItem('currentUserName', currentUser?.name || '');
                localStorage.setItem('currentUserEmail', currentUser?.email || '');
                localStorage.setItem('smart_school_active_role', appId);
            } catch(e) {}
            let suffix = `?role=${encodeURIComponent(currentUser?.role || appId)}&uid=${encodeURIComponent(currentUser?.id || '')}`;
            if ((currentUser?.role || '') === 'leadership') suffix += `&admin=true&bypass=true`;
            window.location.href = target + suffix;
        };

        const roleLabel = (role) => {
            const labels = { leadership: 'قسم مدير النظام', agency: 'قسم الوكيل/ة', performance: 'قسم المعلم/ة' };
            return labels[role] || role || 'غير محدد';
        };

        const safeJs = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');


        const getManagerOwnerId = () => {
            return currentUser?.id || window.auth?.currentUser?.uid || localStorage.getItem('cached_manager_uid') || 'root';
        };

        const getVisibleUsersForCurrentManager = () => {
            if (!currentUser) return [];
            const ownerId = getManagerOwnerId();
            // المدير/ة يرى حسابه، الوكلاء/الوكيلات، والمعلمين/المعلمات المرتبطين به.
            if (currentUser.role === 'leadership') {
                return allUsers.filter(u => {
                    if (!u || u.isDeleted === true) return false;
                    if (u.id === currentUser.id || u.isRootAdmin || isManagerAccount(u.name, u.email)) return true;
                    return !u.adminOwnerId || u.adminOwnerId === ownerId || u.createdByAdminId === ownerId;
                });
            }
            // الوكيل/ة يرى حسابه وقائمة المعلمين/المعلمات فقط لغرض المتابعة والتنبيهات.
            if (currentUser.role === 'agency') {
                return allUsers.filter(u => {
                    if (!u || u.isDeleted === true) return false;
                    if (u.id === currentUser.id) return true;
                    return u.role === 'performance' && u.isActive !== false;
                });
            }
            return allUsers.filter(u => u?.id === currentUser?.id && u?.isDeleted !== true);
        };

        const showUserManagement = () => {
            document.getElementById('user-management-modal').style.display = 'flex';
            renderUserTable();
        };

        const renderUserTable = () => {
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '';
            const sortedUsers = getVisibleUsersForCurrentManager().sort((a, b) => {
                const order = { leadership: 1, agency: 2, performance: 3 };
                return (order[a.role] || 9) - (order[b.role] || 9) || String(a.name || '').localeCompare(String(b.name || ''), 'ar');
            });
            if (sortedUsers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 text-xs">لا يوجد مستخدمون حتى الآن. استخدم زر إضافة حساب لإنشاء مستخدم جديد.</td></tr>';
                return;
            }
            sortedUsers.forEach(u => {
                const isMe = u.id === window.auth.currentUser?.uid || (u.id === 'root' && isManagerVerifiedInSession);
                const isAdminAccount = isManagerAccount(u.name, u.email);
                tbody.innerHTML += `<tr class="hover:bg-slate-50">
                    <td class="p-3 border-b font-bold text-xs text-slate-700">
                        ${u.name || 'بدون اسم'} ${isMe ? '(أنت)' : ''}
                        <div class="text-[10px] text-slate-400 font-normal mt-1">${u.email || ''}</div>
                    </td>
                    <td class="p-3 border-b text-center text-[10px] font-bold text-slate-500">${roleLabel(u.role)}</td>
                    <td class="p-3 border-b text-center">${u.isActive ? '<span class="text-green-600 font-bold">نشط</span>' : '<span class="text-yellow-600 font-bold">معلق</span>'}</td>
                    <td class="p-3 border-b text-center">
                        <div class="flex justify-center gap-2 flex-wrap">
                            <button onclick="openEditModal('${safeJs(u.id)}', '${safeJs(u.name)}', '${safeJs(u.email)}', '${safeJs(u.role)}', ${u.isActive ? 'true' : 'false'})" class="text-blue-600 font-bold text-[10px] hover:underline">تعديل الصلاحيات</button>
                            ${!isAdminAccount ? `<button onclick="toggleActive('${safeJs(u.id)}', ${u.isActive ? 'true' : 'false'})" class="text-orange-600 font-bold text-[10px] hover:underline">${u.isActive ? 'تعليق' : 'تفعيل'}</button>` : ''}
                            ${!isAdminAccount && !isMe ? `<button title="حذف الحساب" onclick="deleteUserAccount('${safeJs(u.id)}')" class="text-red-600 font-bold text-[12px] hover:scale-110 transition">🗑️</button>` : ''}
                        </div>
                    </td>
                </tr>`;
            });
        };

        const toggleActive = async (uid, current) => {
            const newStatus = !current;
            let localUsers = collectLocalUsersForWorkspace();
            let activatedUser = null;
            localUsers = localUsers.map(u => {
                if (String(u.id) !== String(uid)) return u;
                const next = newStatus ? ensureUserWorkspaceReady({ ...u, isActive: true, status: 'active' }) : { ...u, isActive: false, status: 'pending' };
                activatedUser = next;
                return next;
            });
            saveUnifiedUserStores(localUsers);
            renderUserTable();
            try {
                const payload = newStatus ? buildWorkspacePayload(activatedUser || { id: uid }) : { isActive: false, status: 'pending' };
                await window.fs.updateDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', uid), payload);
                showToast(newStatus ? 'تم تفعيل الحساب وتجهيز مساحته الخاصة للدخول والمتابعة' : 'تم تعليق الحساب');
            } catch(e) { showToast(newStatus ? 'تم تفعيل الحساب محليًا وتجهيز مساحته، والسحابة قيد المزامنة' : 'تم التحديث محلياً، والسحابة قيد المزامنة'); }
        };

        const deleteUserAccount = async (uid) => {
            if (!uid) return showToast('لم يتم تحديد الحساب');
            const target = allUsers.find(u => u.id === uid);
            if (!target) return showToast('لم يتم العثور على الحساب');
            const isSelf = uid === currentUser?.id || uid === window.auth?.currentUser?.uid;
            const isProtected = isSelf || target.isRootAdmin || target.isPrimaryManager || isManagerAccount(target.name, target.email) || target.role === 'leadership';
            if (isProtected) return showToast('لا يمكن حذف حساب المدير الرئيسي أو الحساب الحالي');
            const ok = confirm(`هل تريد حذف حساب ${target.name || 'هذا المستخدم'}؟
سيتم إخفاؤه من حسابات المستخدمين وتعطيل دخوله دون حذف بياناته المرتبطة.`);
            if (!ok) return;

            const deletedPayload = {
                isDeleted: true,
                isActive: false,
                deletedAt: new Date().toISOString(),
                deletedByAdminId: getManagerOwnerId()
            };

            const backup = localStorage.getItem('offline_users_backup');
            let localUsers = backup ? JSON.parse(backup) : allUsers;
            localUsers = localUsers.map(u => u.id === uid ? { ...u, ...deletedPayload } : u);
            allUsers = localUsers;
            localStorage.setItem('offline_users_backup', JSON.stringify(localUsers));
            renderUserTable();

            try {
                await window.fs.updateDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', uid), deletedPayload);
                showToast('تم حذف الحساب من القائمة وتعطيل دخوله');
            } catch(e) {
                showToast('تم حذف الحساب محلياً، والسحابة قيد المزامنة');
            }
        };

        let pendingExcelUsersImport = [];

        const normalizeExcelKey = (key) => String(key || '')
            .replace(/[‏‎]/g, '')
            .replace(/\s+/g, '')
            .trim()
            .toLowerCase();

        const getExcelField = (row, keys) => {
            const normalized = {};
            Object.keys(row || {}).forEach(k => normalized[normalizeExcelKey(k)] = row[k]);
            for (const key of keys) {
                const value = normalized[normalizeExcelKey(key)];
                if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
            }
            return '';
        };

        const normalizeImportedRole = (value) => {
            const v = String(value || '').trim().toLowerCase();
            if (!v) return 'performance';
            if (['leadership', 'manager', 'admin', 'مدير', 'مديرة', 'قائد', 'قائدة', 'المدير', 'المديرة'].includes(v)) return 'leadership';
            if (['agency', 'agent', 'vice', 'وكيل', 'وكيلة', 'الوكيل', 'الوكيلة'].includes(v)) return 'agency';
            if (['performance', 'teacher', 'معلم', 'معلمة', 'المعلم', 'المعلمة'].includes(v)) return 'performance';
            return 'performance';
        };

        const openExcelImportModal = () => {
            if (currentUser?.role !== 'leadership') return showToast('استيراد الحسابات مخصص للمدير/ة فقط');
            pendingExcelUsersImport = [];
            const input = document.getElementById('users-excel-file');
            if (input) input.value = '';
            document.getElementById('excel-import-preview-body').innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">لم يتم اختيار ملف بعد.</td></tr>';
            document.getElementById('excel-import-summary').classList.add('hidden');
            document.getElementById('confirm-excel-import-btn').disabled = true;
            document.getElementById('excel-import-modal').style.display = 'flex';
        };

        const downloadUsersExcelTemplate = () => {
            if (typeof XLSX === 'undefined') return showToast('تعذر تحميل مكتبة Excel، تحقق من الاتصال بالإنترنت');
            const rows = [
                { 'الاسم': 'أحمد محمد', 'بريد منصة مدرستي': 'teacher@example.com', 'الرقم السري': 'Pass@12345', 'الدور': 'معلم', 'الجوال': '05XXXXXXXX', 'الهوية': '1XXXXXXXXX' },
                { 'الاسم': 'سارة عبدالله', 'بريد منصة مدرستي': 'agent@example.com', 'الرقم السري': 'Pass@12345', 'الدور': 'وكيل', 'الجوال': '05XXXXXXXX', 'الهوية': '1XXXXXXXXX' }
            ];
            const ws = XLSX.utils.json_to_sheet(rows, { header: ['الاسم', 'بريد منصة مدرستي', 'الرقم السري', 'الدور', 'الجوال', 'الهوية'] });
            ws['!cols'] = [{wch:24},{wch:32},{wch:18},{wch:14},{wch:16},{wch:16}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'طلبات المستخدمين');
            XLSX.writeFile(wb, 'قالب_استيراد_حسابات_المستخدمين.xlsx');
        };

        const previewUsersExcelImport = async () => {
            const file = document.getElementById('users-excel-file')?.files?.[0];
            if (!file) return showToast('اختر ملف Excel أولاً');
            if (typeof XLSX === 'undefined') return showToast('تعذر تحميل مكتبة Excel، تحقق من الاتصال بالإنترنت');
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const existingEmails = new Set((allUsers || []).map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean));
            const seenEmails = new Set();
            pendingExcelUsersImport = [];
            const previewRows = [];

            rows.forEach((row, index) => {
                const name = getExcelField(row, ['الاسم', 'اسم المستخدم', 'name', 'user name', 'fullname', 'full name']);
                const email = getExcelField(row, ['بريد منصة مدرستي', 'بريد مدرستي', 'البريد', 'البريد الإلكتروني', 'الايميل', 'الإيميل', 'email', 'mail', 'madrasati email']);
                const password = getExcelField(row, ['الرقم السري', 'كلمة المرور', 'كلمة السر', 'password', 'pass', 'login password']);
                const rawRole = getExcelField(row, ['الدور', 'الصلاحية', 'القسم', 'role', 'permission']);
                const phone = getExcelField(row, ['الجوال', 'رقم الجوال', 'الهاتف', 'phone', 'mobile']);
                const nationalId = getExcelField(row, ['الهوية', 'رقم الهوية', 'السجل المدني', 'id', 'national id']);
                const normalizedEmail = email.toLowerCase();
                const notes = [];
                let valid = true;
                if (!name) { valid = false; notes.push('الاسم مفقود'); }
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { valid = false; notes.push('بريد منصة مدرستي غير صحيح'); }
                if (!password) { valid = false; notes.push('الرقم السري مفقود'); }
                if (existingEmails.has(normalizedEmail)) { valid = false; notes.push('البريد موجود مسبقًا'); }
                if (seenEmails.has(normalizedEmail)) { valid = false; notes.push('البريد مكرر داخل الملف'); }
                if (normalizedEmail) seenEmails.add(normalizedEmail);
                const role = normalizeImportedRole(rawRole);
                const userData = {
                    id: 'excel-' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8),
                    name,
                    email,
                    password,
                    loginPassword: password,
                    passwordMasked: password ? '••••••' : '',
                    role,
                    phone,
                    nationalId,
                    isActive: false,
                    importSource: 'excel',
                    importedAt: Date.now(),
                    adminOwnerId: getManagerOwnerId(),
                    createdByAdminId: getManagerOwnerId()
                };
                if (valid) pendingExcelUsersImport.push(userData);
                previewRows.push({ ...userData, valid, notes: notes.join('، ') || 'جاهز للاستيراد' });
            });

            const tbody = document.getElementById('excel-import-preview-body');
            if (!previewRows.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">الملف لا يحتوي على بيانات قابلة للقراءة.</td></tr>';
            } else {
                tbody.innerHTML = previewRows.map(u => `<tr class="${u.valid ? 'bg-white' : 'bg-red-50'}">
                    <td class="p-3 border-b font-bold">${u.name || '-'}</td>
                    <td class="p-3 border-b text-slate-500">${u.email || '-'}</td>
                    <td class="p-3 border-b text-center font-bold text-slate-500">${u.passwordMasked || (u.password ? '••••••' : '-')}</td>
                    <td class="p-3 border-b text-center font-bold">${roleLabel(u.role)}</td>
                    <td class="p-3 border-b text-center text-yellow-600 font-bold">معلق</td>
                    <td class="p-3 border-b ${u.valid ? 'text-emerald-700' : 'text-red-600'} font-bold">${u.notes}</td>
                </tr>`).join('');
            }
            const summary = document.getElementById('excel-import-summary');
            summary.innerText = `تمت قراءة ${previewRows.length} صف، الصالح للاستيراد ${pendingExcelUsersImport.length}، وسيتم حفظ الحسابات الصالحة فقط بحالة معلقة مع الاحتفاظ بالرقم السري لواجهة الدخول المستقبلية.`;
            summary.classList.remove('hidden');
            document.getElementById('confirm-excel-import-btn').disabled = pendingExcelUsersImport.length === 0;
        };

        const confirmUsersExcelImport = async () => {
            if (!pendingExcelUsersImport.length) return showToast('لا توجد حسابات صالحة للاستيراد');
            const backup = localStorage.getItem('offline_users_backup');
            let localUsers = backup ? JSON.parse(backup) : (Array.isArray(allUsers) ? [...allUsers] : []);
            const byEmail = new Set(localUsers.map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean));
            const accepted = pendingExcelUsersImport.filter(u => !byEmail.has(String(u.email || '').trim().toLowerCase()));
            accepted.forEach(u => { byEmail.add(String(u.email || '').trim().toLowerCase()); localUsers.push(u); });
            allUsers = localUsers;
            localStorage.setItem('offline_users_backup', JSON.stringify(localUsers));
            renderUserTable();
            try {
                await window.ensureAuth();
                if (window.db && window.fs) {
                    for (const u of accepted) {
                        await window.fs.setDoc(window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', u.id), u, { merge: true });
                    }
                }
                showToast(`تم استيراد ${accepted.length} حساب بحالة معلقة ✅`);
            } catch (e) {
                showToast(`تم استيراد ${accepted.length} حساب محليًا، والسحابة قيد المزامنة`);
            }
            pendingExcelUsersImport = [];
            closeModal('excel-import-modal');
        };

        const canMonitorRole = (targetRole) => {
            if (['leadership','manager'].includes(currentUser?.role)) return ['agency', 'performance', 'agent', 'teacher'].includes(targetRole);
            if (['agency','agent'].includes(currentUser?.role)) return ['performance','teacher'].includes(targetRole);
            return false;
        };

        const showRoleList = (role) => {
            // حصر قوائم التفقد حسب صلاحية الحساب الحالي
            if (currentUser?.role === 'agency' && role !== 'performance') {
                return showToast('صلاحية الوكيل/ة تشمل متابعة المعلمين/المعلمات فقط');
            }
            const titleMap = { leadership: '🏛️ قائمة قسم مدير النظام', agency: '📑 قائمة قسم الوكيل/ة', performance: '👨‍🏫 قائمة قسم المعلم/ة' };
            document.getElementById('role-list-title').innerText = titleMap[role] || 'القائمة';
            const container = document.getElementById('role-list-container');
            container.innerHTML = '';
            const filtered = getVisibleUsersForCurrentManager().filter(u => u.role === role && u.isActive === true && u.isDeleted !== true).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''), 'ar'));
            if (filtered.length === 0) container.innerHTML = '<p class="text-center text-slate-400 text-xs py-10 col-span-2">لا يوجد مستخدمون مسجلون في هذا القسم</p>';
            filtered.forEach(u => {
                const card = document.createElement('div');
                const activeClasses = u.isActive ? 'border-teal-600' : 'border-yellow-500 opacity-75';
                card.className = `bg-slate-50 p-4 rounded-2xl border-r-4 ${activeClasses} flex justify-between items-center gap-3`;
                const status = u.isActive ? '<span class="text-green-600">نشط</span>' : '<span class="text-yellow-600">معلق</span>';
                const monitorButton = u.isActive && canMonitorRole(u.role)
                    ? `<button onclick="launchMonitoring('${safeJs(u.id)}', '${safeJs(u.name)}', '${safeJs(u.role)}')" class="bg-teal-700 text-white px-3 py-1 rounded-lg text-[9px] font-bold">الدخول للتفقد 👁️</button>`
                    : `<span class="text-[10px] text-slate-400 font-bold">${u.isActive ? 'لا توجد صلاحية متابعة' : 'غير مفعل'}</span>`;
                const clickableName = u.isActive && canMonitorRole(u.role)
                    ? `<button onclick="launchMonitoring('${safeJs(u.id)}', '${safeJs(u.name)}', '${safeJs(u.role)}')" class="font-bold text-sm text-teal-800 hover:text-teal-600 underline decoration-dotted underline-offset-4 text-right">${u.name || 'بدون اسم'}</button>`
                    : `<div class="font-bold text-sm">${u.name || 'بدون اسم'}</div>`;
                card.innerHTML = `<div>${clickableName}<div class="text-[10px] text-slate-500">${u.email || ''}</div><div class="text-[10px] font-bold mt-1">${status} - ${roleLabel(u.role)}</div></div>${monitorButton}`;
                container.appendChild(card);
            });
            document.getElementById('role-list-modal').style.display = 'flex';
        };

        const applyMonitoringRestrictions = (iframe) => {
            if (!iframe) return;
            const restrict = () => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc) return;
                    const styleId = 'monitoring-readonly-style';
                    if (!doc.getElementById(styleId)) {
                        const st = doc.createElement('style');
                        st.id = styleId;
                        st.textContent = `
                            [data-monitor-hidden="true"]{display:none!important;}
                            .monitoring-readonly-lock{pointer-events:none!important;opacity:.55!important;filter:grayscale(.35)!important;}
                            body::before{content:'وضع التفقد: تقرير جديد محجوب، والأرشيف للمعاينة والبحث فقط';position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#0f766e;color:white;padding:6px 14px;border-radius:999px;font:700 11px Cairo,Arial;box-shadow:0 8px 20px rgba(0,0,0,.2);}
                        `;
                        doc.head.appendChild(st);
                    }
                    const textOf = el => (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.title || '').trim();
                    doc.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],.btn').forEach(el => {
                        const t = textOf(el);
                        if (/تقرير\s*جديد|إضافة\s*تقرير|إنشاء\s*تقرير|new\s*report/i.test(t)) {
                            el.setAttribute('data-monitor-hidden','true');
                            el.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); return false; };
                        }
                        if (/حذف|تعديل|تحرير|رفع|إضافة|حفظ|اعتماد|إرسال|استيراد|delete|edit|upload|save|submit/i.test(t)) {
                            const area = el.closest('[id*=archive],[class*=archive],[id*=أرشيف],[class*=أرشيف]') || el.closest('[id*=smart],[class*=smart]');
                            if (area) {
                                el.classList.add('monitoring-readonly-lock');
                                el.disabled = true;
                                el.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); return false; };
                            }
                        }
                    });
                    doc.querySelectorAll('input,textarea,select').forEach(el => {
                        const area = el.closest('[id*=archive],[class*=archive],[id*=أرشيف],[class*=أرشيف],[id*=smart],[class*=smart]');
                        const label = textOf(el) + ' ' + (el.placeholder || '') + ' ' + (el.id || '') + ' ' + (el.name || '') + ' ' + (el.className || '');
                        const isSearch = /بحث|search|filter|query/i.test(label);
                        if (area && !isSearch) { el.readOnly = true; el.disabled = true; el.classList.add('monitoring-readonly-lock'); }
                    });
                } catch(e) { console.warn('Monitoring restrictions need same-origin access', e); }
            };
            iframe.addEventListener('load', () => { restrict(); setTimeout(restrict, 700); setTimeout(restrict, 1800); });
            setTimeout(restrict, 700);
        };

        const launchMonitoring = (uid, name, role) => {
            const localUsers = collectLocalUsersForWorkspace();
            let target = localUsers.find(u => String(u.id) === String(uid));
            if (!target) target = localUsers.find(u => normalizeAccountEmail(u.email || u.schoolEmail) && normalizeAccountEmail(u.email || u.schoolEmail) === normalizeAccountEmail(name));
            if (!target) target = { id: uid, name, role };
            if (!canMonitorRole(target.role || role)) return showToast('ليست لديك صلاحية الدخول لهذا الحساب');
            if (target.isActive !== true) return showToast('الحساب غير مفعل بعد');
            target = ensureUserWorkspaceReady(target);
            const updatedUsers = localUsers.map(u => (normalizeAccountEmail(u.email || u.schoolEmail) && normalizeAccountEmail(u.email || u.schoolEmail) === normalizeAccountEmail(target.email || target.schoolEmail)) || String(u.id) === String(target.id) ? { ...u, ...target } : u);
            saveUnifiedUserStores(updatedUsers);

            const v = document.getElementById('viewport-monitoring');
            if (v) {
                v.classList.add('active');
                document.getElementById('main-ui').style.display = 'none';
                document.getElementById('monitored-user-name').innerText = target.name || name || 'مستخدم';
                document.getElementById('backBtn').classList.add('visible');
                const targetRole = target.role || role;
                const files = { 'agency': 'agent.html', 'agent': 'agent.html', 'performance': 'teacher.html', 'teacher': 'teacher.html' };
                const iframe = v.querySelector('iframe');
                const file = files[targetRole] || (String(targetRole).includes('agent') ? 'agent.html' : 'teacher.html');
                const followEmail = normalizeAccountEmail(target.email || target.schoolEmail);
                sessionStorage.setItem('smartSchoolUnifiedOpsV2_last_follow_target', JSON.stringify({id:target.id || uid,name:target.name || name,role:targetRole,email:followEmail,workspaceReady:true}));
                iframe.src = file + `?follow=1&readonly=1&mode=supervisor_readonly&targetUser=${encodeURIComponent(target.id || uid)}&followUserId=${encodeURIComponent(target.id || uid)}&userId=${encodeURIComponent(target.id || uid)}&uid=${encodeURIComponent(target.id || uid)}&followEmail=${encodeURIComponent(followEmail)}&targetEmail=${encodeURIComponent(followEmail)}&targetRole=${encodeURIComponent(targetRole)}&viewer=${encodeURIComponent(currentUser.role)}&viewerRole=${encodeURIComponent(currentUser.role)}&blockNewReport=true&archiveReadOnly=true&workspaceReady=true`;
                applyMonitoringRestrictions(iframe);
            }
            closeModal('role-list-modal');
        };

        const getAllowedNotificationRecipients = () => {
            const role = currentUser?.role || 'performance';
            const allowedRoles = role === 'leadership' ? ['agency', 'performance'] : (role === 'agency' ? ['performance'] : []);
            return getVisibleUsersForCurrentManager()
                .filter(u => u && u.isActive && allowedRoles.includes(u.role) && u.id !== currentUser?.id)
                .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''), 'ar'));
        };

        const updateNotifCounter = () => {
            const txt = document.getElementById('notif-text');
            const counter = document.getElementById('notif-counter');
            if (txt && counter) counter.innerText = `${txt.value.length} / 300`;
        };

        const renderNotifRecipients = () => {
            const list = document.getElementById('notif-recipients-list');
            const hint = document.getElementById('notif-recipient-hint');
            if (!list) return;
            const recipients = getAllowedNotificationRecipients();
            list.innerHTML = '';
            if (recipients.length === 0) {
                list.innerHTML = '<p class="text-center text-slate-400 text-xs py-6 md:col-span-2">لا يوجد مستلمون متاحون حسب صلاحية هذا الحساب</p>';
                if (hint) hint.innerText = currentUser?.role === 'agency' ? 'صلاحية الوكيل/ة تشمل المعلمين/المعلمات فقط.' : 'صلاحية المدير/ة تشمل الوكلاء/الوكيلات والمعلمين/المعلمات.';
                return;
            }
            recipients.forEach(u => {
                const label = document.createElement('label');
                label.className = 'flex items-center gap-2 bg-white p-2 rounded-xl border text-xs cursor-pointer hover:bg-teal-50';
                label.innerHTML = `<input type="checkbox" class="notif-recipient" value="${safeJs(u.id)}" data-role="${safeJs(u.role)}" data-name="${safeJs(u.name)}"><span><b>${u.name || 'بدون اسم'}</b><br><small class="text-slate-500">${roleLabel(u.role)}</small></span>`;
                list.appendChild(label);
            });
            if (hint) hint.innerText = currentUser?.role === 'agency' ? 'يمكن للوكيل/ة الإرسال إلى قسم المعلم/ة فقط.' : 'يمكن للمدير/ة الإرسال إلى قسم الوكيل/ة وقسم المعلم/ة.';
        };

        const toggleNotifRecipients = (checked) => {
            document.querySelectorAll('.notif-recipient').forEach(cb => cb.checked = checked);
        };

        const showSendNotifModal = () => {
            if (!['leadership', 'agency'].includes(currentUser?.role)) return showToast('ليست لديك صلاحية إرسال التنبيهات');
            document.getElementById('notif-text').value = '';
            document.getElementById('notif-link').value = '';
            document.getElementById('notif-file').value = '';
            document.getElementById('notif-select-all').checked = false;
            updateNotifCounter();
            renderNotifRecipients();
            document.getElementById('send-notif-modal').style.display = 'flex';
        };

        const readNotifAttachment = () => new Promise((resolve) => {
            const fileInput = document.getElementById('notif-file');
            const file = fileInput?.files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type || 'file', size: file.size, data: reader.result });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        const saveNotification = async () => {
            const text = document.getElementById('notif-text').value.trim();
            const type = document.getElementById('notif-type').value;
            const link = document.getElementById('notif-link').value.trim();
            const selected = [...document.querySelectorAll('.notif-recipient:checked')];
            if (!text) return showToast("اكتب نص التنبيه أولاً");
            if (text.length > 300) return showToast("نص التنبيه يتجاوز 300 حرف");
            if (selected.length === 0) return showToast("اختر مستلماً واحداً على الأقل أو اختر الكل");
            if (link && !/^https?:\/\//i.test(link)) return showToast("الرابط يجب أن يبدأ بـ http أو https");
            const attachment = await readNotifAttachment();
            const recipients = selected.map(cb => ({ id: cb.value, role: cb.dataset.role, name: cb.dataset.name }));
            try {
                const payload = {
                    text,
                    type,
                    link: link || '',
                    attachment,
                    sender: currentUser.name,
                    senderId: currentUser.id || window.auth.currentUser?.uid || 'unknown',
                    senderRole: currentUser.role,
                    recipientIds: recipients.map(r => r.id),
                    recipientRoles: [...new Set(recipients.map(r => r.role))],
                    recipientNames: recipients.map(r => r.name),
                    timestamp: Date.now()
                };
                await window.fs.addDoc(window.fs.collection(window.db, 'artifacts', window.appId, 'public', 'data', 'notifications'), payload);
                showToast("تم إرسال التنبيه");
                closeModal('send-notif-modal');
            } catch(e) { showToast("خطأ في الإرسال"); }
        };

        const canCurrentUserReadNotification = (n) => {
            if (!currentUser) return false;
            if (n.senderId && (n.senderId === currentUser.id || n.senderId === window.auth.currentUser?.uid)) return true;
            if (Array.isArray(n.recipientIds) && n.recipientIds.includes(currentUser.id)) return true;
            if (Array.isArray(n.recipientRoles) && n.recipientRoles.includes(currentUser.role)) return true;
            // دعم التنبيهات القديمة التي لم تكن تحتوي على مستلمين
            return !n.recipientIds && !n.recipientRoles;
        };

        const openAlertsPopup = () => {
            const container = document.getElementById('alerts-container');
            container.innerHTML = '';
            const visibleNotifications = allNotifications.filter(canCurrentUserReadNotification);
            if (visibleNotifications.length === 0) container.innerHTML = '<p class="text-center text-slate-400 py-10">لا يوجد تنبيهات</p>';
            visibleNotifications.forEach(n => {
                const div = document.createElement('div');
                div.className = `p-4 rounded-2xl border-r-4 ${n.type === 'critical' ? 'bg-red-50 border-red-500 text-red-900' : 'bg-yellow-50 border-yellow-500 text-yellow-900'} mb-3`;
                const recipientsText = Array.isArray(n.recipientNames) && n.recipientNames.length ? `<div class="text-[10px] opacity-70 mt-1">إلى: ${n.recipientNames.join('، ')}</div>` : '';
                const linkHtml = n.link ? `<a href="${n.link}" target="_blank" rel="noopener" class="inline-block mt-3 text-blue-700 underline text-xs font-bold">فتح الرابط 🔗</a>` : '';
                const attachmentHtml = n.attachment?.data ? `<a href="${n.attachment.data}" download="${n.attachment.name || 'attachment'}" class="inline-block mt-3 mx-2 text-teal-700 underline text-xs font-bold">تحميل المرفق 📎</a>` : '';
                div.innerHTML = `<div class="font-bold text-xs mb-1">${n.sender || 'مرسل غير محدد'} <span class="font-normal opacity-70">${new Date(n.timestamp || Date.now()).toLocaleString('ar-SA')}</span></div><div class="text-sm whitespace-pre-wrap">${n.text || ''}</div>${recipientsText}${linkHtml}${attachmentHtml}`;
                container.appendChild(div);
            });
            document.getElementById('alerts-popup-modal').style.display = 'flex';
        };

        const openEditModal = (uid, n, e, r, active = true) => { 
            document.getElementById('edit-uid').value = uid; 
            document.getElementById('edit-name').value = n; 
            document.getElementById('edit-email').value = e; 
            document.getElementById('edit-role').value = r || 'performance'; 
            const activeSelect = document.getElementById('edit-active');
            if (activeSelect) activeSelect.value = active ? 'true' : 'false';
            document.getElementById('edit-modal-title').innerText = uid && String(uid).startsWith('user-') ? 'إضافة مستخدم جديد' : 'تعديل المستخدم والصلاحيات';
            document.getElementById('edit-user-modal').style.display = 'flex'; 
        };

        // تفعيل وحل مشكلة الحفظ للمدير (إضافة وتعديل)
        const saveUserEdit = async () => {
            const uid = document.getElementById('edit-uid').value;
            const name = document.getElementById('edit-name').value.trim();
            const email = document.getElementById('edit-email').value.trim();
            const role = document.getElementById('edit-role').value;
            const selectedActive = document.getElementById('edit-active') ? document.getElementById('edit-active').value === 'true' : true;
            
            if (!name || !email) { showToast("يرجى ملء البيانات"); return; }
            
            // في حال كان المستخدم الحالي هو admin وقام بتعديل نفسه، نضمن بقاءه مديراً
            const isEditingSelfAdmin = (uid === 'root' || uid === window.auth.currentUser?.uid) && isManagerVerifiedInSession;
            const finalRole = isEditingSelfAdmin ? 'leadership' : role;
            
            const userData = { 
                id: uid, 
                name, 
                email, 
                role: finalRole, 
                isActive: isEditingSelfAdmin ? true : selectedActive,
                adminOwnerId: isEditingSelfAdmin ? getManagerOwnerId() : (allUsers.find(u => u.id === uid)?.adminOwnerId || getManagerOwnerId()),
                createdByAdminId: getManagerOwnerId(),
                isRootAdmin: isEditingSelfAdmin // وسم داخلي لضمان الصلاحية حتى بعد تغيير الاسم
            };
            
            // تحديث محلي فوري للاستجابة
            const backup = localStorage.getItem('offline_users_backup');
            let localUsers = backup ? JSON.parse(backup) : [];
            const existingIdx = localUsers.findIndex(u => u.id === uid);
            if (existingIdx > -1) localUsers[existingIdx] = userData; else localUsers.push(userData);
            allUsers = localUsers;
            localStorage.setItem('offline_users_backup', JSON.stringify(localUsers));
            renderUserTable(); 
            if (document.getElementById('role-list-modal')?.style.display === 'flex') showRoleList(finalRole);

            try {
                const user = await window.ensureAuth();
                if (!user) throw new Error("Auth Required");

                const docRef = window.fs.doc(window.db, 'artifacts', window.appId, 'public', 'data', 'users', uid);
                await window.fs.setDoc(docRef, userData, {merge:true});
                
                showToast("تم حفظ المستخدم وتحديث صلاحياته ✅");
                closeModal('edit-user-modal');
                
                // إذا قام المدير بتعديل نفسه، نقوم بتحديث واجهته فوراً
                if(isEditingSelfAdmin) {
                    currentUser.name = name;
                    currentUser.email = email;
                    document.getElementById('active-role-badge').innerText = 'مدير النظام';
                }
            } catch(e) {
                showToast("تم الحفظ محلياً بنجاح ⚠️ (السحابة قيد المزامنة)");
                closeModal('edit-user-modal');
            }
        };

        const copyRegLinkForUsers = () => { 
            if (currentUser?.role !== 'leadership') return showToast("رابط التسجيل مخصص لحساب المدير/ة فقط");
            const adminId = getManagerOwnerId();
            const storageKey = 'manager_registration_token_' + adminId;
            let token = localStorage.getItem(storageKey);
            if (!token) {
                token = (crypto?.randomUUID?.() || ('reg-' + Date.now() + '-' + Math.random().toString(36).slice(2)));
                localStorage.setItem(storageKey, token);
            }
            const currentPath = window.location.href.split('?')[0];
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            const registerPath = basePath + 'register.html';
            const schoolId = localStorage.getItem('current_school_id') || ('school_' + adminId);
            const schoolName = localStorage.getItem('current_school_name') || 'مدرستي';
            const regLink = `${registerPath}?admin=${encodeURIComponent(adminId)}&token=${encodeURIComponent(token)}&schoolId=${encodeURIComponent(schoolId)}&schoolName=${encodeURIComponent(schoolName)}`;
            const t = document.createElement('input');
            t.value = regLink;
            document.body.appendChild(t);
            t.select();
            document.execCommand('copy');
            document.body.removeChild(t);
            showToast("تم نسخ رابط التسجيل المرتبط بالمدرسة ويفتح نموذج التسجيل مباشرة"); 
        };



        /* ===== قاعة الاجتماعات - المرحلة الأولى ===== */
        let meetingChatLines = [];
        let currentMeetingForPrint = null;

        const meetingsStorageKey = () => 'school_meetings_archive_' + (getManagerOwnerId ? getManagerOwnerId() : 'default');

        const getStoredMeetings = () => {
            try { return JSON.parse(localStorage.getItem(meetingsStorageKey()) || '[]'); }
            catch(e) { return []; }
        };

        const setStoredMeetings = (items) => localStorage.setItem(meetingsStorageKey(), JSON.stringify(items || []));

        const showMeetingsRoom = () => {
            if (!currentUser) return showToast('يرجى تسجيل الدخول أولاً');
            document.getElementById('meetings-room-modal').style.display = 'flex';
            if (!document.getElementById('meeting-date').value) document.getElementById('meeting-date').valueAsDate = new Date();
            if (!document.getElementById('meeting-time').value) {
                const d = new Date();
                document.getElementById('meeting-time').value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
            }
            renderMeetingParticipants();
            renderMeetingsArchive();
        };

        const resetMeetingForm = () => {
            ['meeting-title','meeting-teams-url','meeting-agenda','meeting-recommendations','meeting-tasks','meeting-chat-input'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const files = document.getElementById('meeting-files'); if (files) files.value = '';
            meetingChatLines = [];
            const list = document.getElementById('meeting-chat-list'); if (list) list.innerHTML = '';
            renderMeetingParticipants();
        };

        const meetingVisibleUsers = () => {
            const users = Array.isArray(allUsers) ? allUsers : [];
            if (currentUser?.role === 'leadership') return users.filter(u => u.isActive !== false);
            if (currentUser?.role === 'agency') return users.filter(u => u.role === 'performance' && u.isActive !== false);
            return users.filter(u => u.id === currentUser.id || u.email === currentUser.email);
        };

        const renderMeetingParticipants = () => {
            const box = document.getElementById('meeting-participants-list');
            if (!box) return;
            const users = meetingVisibleUsers();
            if (!users.length) {
                box.innerHTML = '<div class="text-center text-slate-400 bg-slate-50 rounded-xl p-4 text-xs">لا توجد حسابات مفعلة للاختيار حالياً</div>';
                return;
            }
            box.innerHTML = users.map(u => `
                <label class="flex items-center gap-2 p-2 rounded-xl border bg-slate-50 cursor-pointer hover:bg-teal-50">
                    <input type="checkbox" class="meeting-participant" value="${safeJs(u.id)}" data-name="${safeJs(u.name)}" data-role="${safeJs(u.role)}">
                    <span class="font-bold text-xs text-slate-700">${u.name || 'مستخدم'}</span>
                    <span class="text-[10px] text-slate-400 mr-auto">${roleLabel(u.role)}</span>
                </label>
            `).join('');
        };

        const toggleMeetingParticipants = (checked) => document.querySelectorAll('.meeting-participant').forEach(cb => cb.checked = checked);

        const addMeetingChatLine = () => {
            const input = document.getElementById('meeting-chat-input');
            const text = (input?.value || '').trim();
            if (!text) return;
            meetingChatLines.push({ by: currentUser?.name || 'مستخدم', text, time: Date.now() });
            input.value = '';
            renderMeetingChat();
        };

        const renderMeetingChat = () => {
            const list = document.getElementById('meeting-chat-list');
            if (!list) return;
            list.innerHTML = meetingChatLines.map(m => `<div class="bg-slate-50 border rounded-lg p-2"><b>${m.by}</b>: ${m.text}</div>`).join('');
        };

        const readMeetingAttachments = () => new Promise((resolve) => {
            const input = document.getElementById('meeting-files');
            const files = Array.from(input?.files || []);
            if (!files.length) return resolve([]);
            const out = [];
            let done = 0;
            files.forEach(file => {
                if (file.size > 900000) { out.push({ name: file.name, type: file.type, skipped: true, note: 'حجم الملف كبير للحفظ المحلي' }); if (++done === files.length) resolve(out); return; }
                const reader = new FileReader();
                reader.onload = () => { out.push({ name: file.name, type: file.type, data: reader.result }); if (++done === files.length) resolve(out); };
                reader.onerror = () => { out.push({ name: file.name, type: file.type, skipped: true }); if (++done === files.length) resolve(out); };
                reader.readAsDataURL(file);
            });
        });


        const copyTeamsInstruction = async () => {
            const txt = 'افتح Microsoft Teams بحساب منصة مدرستي، أنشئ اجتماعاً جديداً، انسخ رابط الانضمام، ثم الصقه في حقل رابط اجتماع Microsoft Teams داخل قاعة الاجتماعات في المنصة.';
            try { await navigator.clipboard.writeText(txt); showToast('تم نسخ تعليمات إنشاء رابط Teams'); }
            catch(e) { showToast(txt); }
        };

        const saveMeetingRecord = async () => {
            const title = document.getElementById('meeting-title').value.trim();
            if (!title) return showToast('اكتب عنوان الاجتماع أولاً');
            const selected = [...document.querySelectorAll('.meeting-participant:checked')];
            if (!selected.length) return showToast('اختر مشاركاً واحداً على الأقل');
            const attachments = await readMeetingAttachments();
            const record = {
                id: 'meet-' + Date.now(),
                title,
                type: document.getElementById('meeting-type').value,
                date: document.getElementById('meeting-date').value,
                time: document.getElementById('meeting-time').value,
                teamsUrl: document.getElementById('meeting-teams-url')?.value.trim() || '',
                agenda: document.getElementById('meeting-agenda').value.trim(),
                recommendations: document.getElementById('meeting-recommendations').value.trim(),
                tasks: document.getElementById('meeting-tasks').value.trim(),
                chat: meetingChatLines,
                attachments,
                participants: selected.map(cb => ({ id: cb.value, name: cb.dataset.name, role: cb.dataset.role })),
                createdBy: currentUser?.name || 'غير محدد',
                createdByRole: currentUser?.role || '',
                createdAt: Date.now()
            };
            const items = getStoredMeetings();
            items.unshift(record);
            setStoredMeetings(items);
            currentMeetingForPrint = record;
            renderMeetingsArchive();
            showToast('تم حفظ محضر الاجتماع في الأرشيف ✅');

            try {
                if (window.db && window.fs && currentUser?.role !== 'performance') {
                    await window.fs.addDoc(window.fs.collection(window.db, 'artifacts', window.appId, 'public', 'data', 'notifications'), {
                        text: 'تم إنشاء اجتماع جديد عبر Microsoft Teams: ' + title,
                        type: 'normal',
                        link: record.teamsUrl || '',
                        attachment: null,
                        sender: currentUser.name,
                        senderId: currentUser.id || window.auth.currentUser?.uid || 'unknown',
                        senderRole: currentUser.role,
                        recipientIds: record.participants.map(p => p.id),
                        recipientRoles: [...new Set(record.participants.map(p => p.role))],
                        recipientNames: record.participants.map(p => p.name),
                        timestamp: Date.now()
                    });
                }
            } catch(e) { console.warn('meeting notification skipped', e); }
        };

        const renderMeetingsArchive = () => {
            const box = document.getElementById('meetings-archive-container');
            if (!box) return;
            const items = getStoredMeetings().filter(m => {
                if (currentUser?.role === 'leadership') return true;
                if (currentUser?.role === 'agency') return m.createdByRole === 'agency' || m.participants?.some(p => p.id === currentUser.id || p.role === 'performance');
                return m.participants?.some(p => p.id === currentUser.id || p.name === currentUser.name);
            });
            if (!items.length) {
                box.innerHTML = '<div class="col-span-full text-center text-slate-400 bg-white rounded-2xl border p-6 text-sm">لا توجد اجتماعات محفوظة حتى الآن</div>';
                return;
            }
            box.innerHTML = items.map(m => `
                <div class="bg-white border rounded-2xl p-4 shadow-sm">
                    <div class="font-extrabold text-slate-800 text-sm mb-1">${m.title}</div>
                    <div class="text-[11px] text-slate-500 mb-2">${m.type || ''} - ${m.date || ''} ${m.time || ''}</div>
                    <div class="text-[11px] text-teal-700 font-bold mb-3">المشاركون: ${(m.participants || []).map(p => p.name).join('، ') || 'غير محدد'}</div>
                    <div class="flex gap-2">
                        <button onclick="printMeetingById('${m.id}')" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-[10px] font-bold">طباعة</button>
                        <button onclick="sendMeetingMinutesById('${m.id}')" class="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-lg text-[10px] font-bold">إرسال للمشاركين</button>
                        <button onclick="deleteMeetingById('${m.id}')" class="bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-lg text-[10px] font-bold">حذف</button>
                    </div>
                </div>
            `).join('');
        };

        const meetingPortfolioItemsForCurrentUser = () => getStoredMeetings().filter(m => {
            if (currentUser?.role === 'leadership') return true;
            if (currentUser?.role === 'agency') return m.createdByRole === 'agency' || m.createdByRole === 'leadership' || m.participants?.some(p => p.id === currentUser.id || p.role === 'performance');
            return m.participants?.some(p => p.id === currentUser.id || p.name === currentUser.name) || m.createdBy === currentUser?.name;
        });

        const openMeetingPortfolio = () => {
            document.getElementById('meetings-portfolio-modal').style.display = 'flex';
            renderMeetingPortfolio();
        };

        const renderMeetingPortfolio = () => {
            const box = document.getElementById('meetings-portfolio-list');
            if (!box) return;
            const search = (document.getElementById('meeting-portfolio-search')?.value || '').trim().toLowerCase();
            const type = document.getElementById('meeting-portfolio-type')?.value || '';
            let items = meetingPortfolioItemsForCurrentUser();
            const now = new Date();
            const thisMonth = String(now.getFullYear()) + '-' + String(now.getMonth()+1).padStart(2,'0');
            const stats = {
                total: items.length,
                month: items.filter(m => (m.date || '').startsWith(thisMonth)).length,
                files: items.filter(m => (m.attachments || []).length).length,
                participation: items.filter(m => (m.participants || []).some(p => p.id === currentUser?.id || p.name === currentUser?.name)).length
            };
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setText('portfolio-total', stats.total);
            setText('portfolio-month', stats.month);
            setText('portfolio-files', stats.files);
            setText('portfolio-participation', stats.participation);
            if (type) items = items.filter(m => m.type === type);
            if (search) items = items.filter(m => [m.title, m.type, m.date, m.time, m.agenda, m.recommendations, m.tasks, m.createdBy, ...(m.participants || []).map(p => p.name)].join(' ').toLowerCase().includes(search));
            const details = document.getElementById('meeting-portfolio-details');
            const picker = document.getElementById('meeting-archive-picker');
            if (picker) picker.classList.add('hidden');
            if (!items.length) {
                box.innerHTML = '<div class="col-span-full text-center text-slate-400 bg-white rounded-2xl border p-6 text-sm">لا توجد محاضر مطابقة في محفظة الاجتماعات</div>';
                if (details) details.classList.add('hidden');
                return;
            }
            box.innerHTML = items.map(m => `
                <label class="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition block cursor-pointer">
                    <div class="flex justify-between gap-2 items-start mb-2">
                        <div class="flex gap-2 items-start">
                            <input type="checkbox" name="meetingPortfolioSelect" value="${safeJs(m.id)}" class="mt-1" onchange="document.querySelectorAll('input[name=meetingPortfolioSelect]').forEach(cb=>{ if(cb!==this) cb.checked=false; });">
                            <div class="font-extrabold text-slate-800 text-sm">${m.title || 'اجتماع بدون عنوان'}</div>
                        </div>
                        <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-lg text-[10px] font-bold">${m.type || 'اجتماع'}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mb-2">📅 ${m.date || 'بدون تاريخ'} - ⏰ ${m.time || ''}</div>
                    <div class="text-[11px] text-teal-700 font-bold mb-2">منشئ المحضر: ${m.createdBy || 'غير محدد'}</div>
                    <div class="text-[11px] text-slate-500 mb-3 line-clamp-2">${(m.recommendations || m.agenda || 'لا توجد توصيات مسجلة').slice(0, 120)}</div>
                    <div class="text-[10px] text-slate-400 mb-3">📎 ${(m.attachments || []).length} مرفق | 👥 ${(m.participants || []).length} مشارك | ${m.teamsUrl ? '🔗 رابط Teams متاح' : 'بدون رابط Teams'}</div>
                    ${m.teamsUrl ? `<a href="${m.teamsUrl}" target="_blank" onclick="event.stopPropagation()" class="inline-block bg-purple-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold">فتح رابط Teams</a>` : ''}
                </label>
            `).join('');
        };

        const selectedMeetingPortfolioId = () => {
            const el = document.querySelector('input[name="meetingPortfolioSelect"]:checked');
            return el ? el.value : '';
        };

        const selectedMeetingPortfolioRecord = () => {
            const id = selectedMeetingPortfolioId();
            if (!id) {
                showToast('يرجى تحديد محضر اجتماع أولًا بوضع علامة صح');
                return null;
            }
            const m = getStoredMeetings().find(x => String(x.id) === String(id));
            if (!m) showToast('تعذر العثور على محضر الاجتماع المحدد');
            return m || null;
        };

        const previewSelectedMeetingPortfolio = () => {
            const m = selectedMeetingPortfolioRecord();
            if (!m) return;
            showMeetingPortfolioDetails(m.id);
        };

        const meetingPlainText = (m) => [
            'محضر اجتماع',
            'العنوان: ' + (m.title || ''),
            'النوع: ' + (m.type || ''),
            'التاريخ: ' + (m.date || '') + ' ' + (m.time || ''),
            'منشئ المحضر: ' + (m.createdBy || ''),
            m.teamsUrl ? ('رابط Teams: ' + m.teamsUrl) : '',
            '',
            'المشاركون:',
            (m.participants || []).map(p => (p.name || '') + ' - ' + roleLabel(p.role)).join('\n') || 'غير محدد',
            '',
            'محاور الاجتماع:',
            m.agenda || '',
            '',
            'التوصيات والقرارات:',
            m.recommendations || '',
            '',
            'المهام الناتجة:',
            m.tasks || ''
        ].filter(Boolean).join('\n');

        const downloadSelectedMeetingPortfolio = () => {
            const m = selectedMeetingPortfolioRecord();
            if (!m) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([meetingPlainText(m)], { type: 'text/plain;charset=utf-8' }));
            a.download = ((m.title || 'محضر_اجتماع').replace(/[\\/:*?"<>|]/g, '_')) + '.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };

        const meetingArchiveFoldersForCurrentSection = () => {
            try {
                if (window.SmartSchoolCloudStorage && typeof window.SmartSchoolCloudStorage.structure === 'function') {
                    const folders = (window.SmartSchoolCloudStorage.structure().folders || []).filter(Boolean);
                    if (folders.length) return folders.map((path, idx) => ({ id: 'cloud-folder-' + idx, name: String(path).split('/').pop() || path, path }));
                }
            } catch(e) {}
            const role = currentUser?.role || 'main';
            const base = role === 'leadership' ? ['محاضر اجتماعات الإدارة','التقارير الرسمية','التعاميم','الخطط','الشواهد'] : role === 'agency' ? ['محاضر اجتماعات الوكيل','متابعة المعلمين','التقارير الرسمية','الشواهد'] : ['محاضر الاجتماعات','التقارير الصفية','الشواهد','ملفات مرفقة'];
            return base.map((name, idx) => ({ id: 'folder-' + idx, name, path: name }));
        };

        const openMeetingArchiveFolderPicker = () => {
            const m = selectedMeetingPortfolioRecord();
            if (!m) return;
            const picker = document.getElementById('meeting-archive-picker');
            if (!picker) return;
            const folders = meetingArchiveFoldersForCurrentSection();
            picker.classList.remove('hidden');
            picker.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-end gap-3">
                    <div class="flex-1">
                        <div class="font-extrabold text-slate-800 mb-1">إرسال محضر الاجتماع إلى الأرشيف</div>
                        <div class="text-[11px] text-slate-500 mb-2">المحضر المحدد: ${m.title || 'محضر اجتماع'}</div>
                        <select id="meetingArchiveFolderSelect" class="w-full p-3 border rounded-xl text-sm bg-white">
                            ${folders.map(f => `<option value="${safeJs(f.id)}" data-path="${safeJs(f.path)}">${f.name}</option>`).join('')}
                        </select>
                    </div>
                    <button onclick="sendSelectedMeetingToArchive()" class="bg-amber-600 text-white px-6 py-3 rounded-xl text-xs font-extrabold">إرسال</button>
                    <button onclick="document.getElementById('meeting-archive-picker').classList.add('hidden')" class="bg-white border text-slate-600 px-6 py-3 rounded-xl text-xs font-bold">إلغاء</button>
                </div>`;
            picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };

        const sendSelectedMeetingToArchive = () => {
            const m = selectedMeetingPortfolioRecord();
            if (!m) return;
            const select = document.getElementById('meetingArchiveFolderSelect');
            if (!select) return showToast('اختر مجلد الأرشيف أولًا');
            const selectedOption = select.options[select.selectedIndex];
            const folderName = selectedOption?.textContent || 'محاضر الاجتماعات';
            const folderPath = selectedOption?.dataset?.path || folderName;
            const record = {
                id: 'meeting-archive-' + Date.now(),
                title: 'محضر اجتماع - ' + (m.title || 'بدون عنوان'),
                category: select.value,
                folderName,
                folderPath,
                createdAt: new Date().toISOString(),
                date: m.date || new Date().toISOString().slice(0,10),
                isComplete: true,
                readOnly: true,
                archiveType: 'meetingMinutes',
                source: 'meeting_wallet',
                meetingId: m.id,
                content: `<div class="meeting-minutes-readonly"><h2>محضر اجتماع</h2><h3>${m.title || 'محضر اجتماع'}</h3><p><b>النوع:</b> ${m.type || ''}</p><p><b>التاريخ:</b> ${m.date || ''} ${m.time || ''}</p><p><b>منشئ المحضر:</b> ${m.createdBy || ''}</p>${m.teamsUrl ? `<p><b>رابط Teams:</b> <a target="_blank" href="${m.teamsUrl}">فتح الرابط</a></p>` : ''}<hr><h4>المشاركون</h4><p>${(m.participants || []).map(p => (p.name || '') + ' - ' + roleLabel(p.role)).join('<br>') || 'غير محدد'}</p><h4>محاور الاجتماع</h4><div style="white-space:pre-wrap">${m.agenda || ''}</div><h4>التوصيات والقرارات</h4><div style="white-space:pre-wrap">${m.recommendations || ''}</div><h4>المهام الناتجة</h4><div style="white-space:pre-wrap">${m.tasks || ''}</div></div>`
            };
            const keys = ['reports_archive', 'school_reports', 'meeting_minutes_archive_' + (currentUser?.role || 'main')];
            keys.forEach(key => {
                try {
                    const arr = JSON.parse(localStorage.getItem(key) || '[]');
                    arr.unshift(record);
                    localStorage.setItem(key, JSON.stringify(arr));
                } catch(e) {}
            });
            const picker = document.getElementById('meeting-archive-picker');
            if (picker) picker.classList.add('hidden');
            showToast('تم إرسال محضر الاجتماع إلى الأرشيف كمعاينة فقط');
        };

        const showMeetingPortfolioDetails = (id) => {
            const m = getStoredMeetings().find(x => x.id === id);
            const details = document.getElementById('meeting-portfolio-details');
            if (!m || !details) return;
            details.classList.remove('hidden');
            details.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-extrabold text-slate-800">تفاصيل المحضر: ${m.title || ''}</h4>
                    <button onclick="document.getElementById('meeting-portfolio-details').classList.add('hidden')" class="text-xs text-slate-400 font-bold">إخفاء</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div class="bg-white border rounded-xl p-3"><b class="text-teal-700">النوع:</b> ${m.type || ''}</div>
                    <div class="bg-white border rounded-xl p-3"><b class="text-teal-700">التاريخ والوقت:</b> ${m.date || ''} ${m.time || ''}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2"><b class="text-teal-700">رابط Teams:</b><br>${m.teamsUrl ? `<a href="${m.teamsUrl}" target="_blank" class="inline-block mt-2 bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold">الانضمام للاجتماع عبر Microsoft Teams</a><div class="text-[11px] text-slate-500 mt-2 break-all">${m.teamsUrl}</div>` : 'لم يتم إضافة رابط Teams لهذا الاجتماع'}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2"><b class="text-teal-700">المشاركون:</b><br>${(m.participants || []).map(p => `${p.name || ''} - ${roleLabel(p.role)}`).join('<br>') || 'غير محدد'}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2 whitespace-pre-wrap"><b class="text-teal-700">محاور الاجتماع:</b><br>${m.agenda || ''}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2 whitespace-pre-wrap"><b class="text-teal-700">التوصيات والقرارات:</b><br>${m.recommendations || ''}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2 whitespace-pre-wrap"><b class="text-teal-700">المهام الناتجة:</b><br>${m.tasks || ''}</div>
                    <div class="bg-white border rounded-xl p-3 md:col-span-2"><b class="text-teal-700">المرفقات:</b><br>${(m.attachments || []).map(a => a.data ? `<a class="text-blue-700 underline" href="${a.data}" download="${a.name}">${a.name}</a>` : `${a.name} - ${a.note || 'غير محفوظ محلياً'}`).join('<br>') || 'لا توجد مرفقات'}</div>
                </div>
            `;
            details.scrollIntoView({behavior:'smooth', block:'nearest'});
        };

        const printMeetingById = (id) => {
            const m = getStoredMeetings().find(x => x.id === id);
            if (!m) return showToast('لم يتم العثور على الاجتماع');
            currentMeetingForPrint = m;
            printCurrentMeeting();
        };

        const deleteMeetingById = (id) => {
            if (!confirm('هل تريد حذف محضر الاجتماع من الأرشيف المحلي؟')) return;
            setStoredMeetings(getStoredMeetings().filter(x => x.id !== id));
            renderMeetingsArchive();
            showToast('تم حذف الاجتماع');
        };


        const getCurrentMeetingDraft = () => {
            const selected = [...document.querySelectorAll('.meeting-participant:checked')];
            return currentMeetingForPrint || {
                id: 'meet-draft-' + Date.now(),
                title: document.getElementById('meeting-title')?.value?.trim() || 'محضر اجتماع',
                type: document.getElementById('meeting-type')?.value || '',
                date: document.getElementById('meeting-date')?.value || '',
                time: document.getElementById('meeting-time')?.value || '',
                teamsUrl: document.getElementById('meeting-teams-url')?.value?.trim() || '',
                agenda: document.getElementById('meeting-agenda')?.value?.trim() || '',
                recommendations: document.getElementById('meeting-recommendations')?.value?.trim() || '',
                tasks: document.getElementById('meeting-tasks')?.value?.trim() || '',
                chat: meetingChatLines || [],
                attachments: [],
                participants: selected.map(cb => ({ id: cb.value, name: cb.dataset.name, role: cb.dataset.role })),
                createdBy: currentUser?.name || 'غير محدد',
                createdByRole: currentUser?.role || '',
                createdAt: Date.now()
            };
        };

        const buildMeetingMinutesNoticeText = (m) => {
            const participants = (m.participants || []).map(p => p.name).join('، ') || 'غير محدد';
            return [
                '📄 تم إرسال محضر اجتماع للمشاركين',
                'العنوان: ' + (m.title || ''),
                'النوع: ' + (m.type || ''),
                'التاريخ: ' + (m.date || '') + ' ' + (m.time || ''),
                'المرسل: ' + (currentUser?.name || m.createdBy || 'غير محدد'),
                'المشاركون: ' + participants,
                '',
                'جدول الأعمال:',
                m.agenda || 'غير مدخل',
                '',
                'التوصيات:',
                m.recommendations || 'غير مدخلة',
                '',
                'المهام:',
                m.tasks || 'غير مدخلة',
                m.teamsUrl ? ('\nرابط Teams: ' + m.teamsUrl) : ''
            ].join('\n');
        };

        const persistMeetingMinutesLocallyForParticipants = (meeting, notificationPayload) => {
            try {
                const key = 'smart_school_sent_meeting_minutes';
                const saved = JSON.parse(localStorage.getItem(key) || '[]');
                saved.unshift({ ...notificationPayload, meetingId: meeting.id, savedAt: Date.now() });
                localStorage.setItem(key, JSON.stringify(saved.slice(0, 200)));

                const meetings = getStoredMeetings();
                if (!meetings.some(x => x.id === meeting.id)) {
                    meetings.unshift(meeting);
                    setStoredMeetings(meetings);
                }

                if (Array.isArray(allNotifications)) {
                    allNotifications.unshift(notificationPayload);
                    const badge = document.getElementById('bell-badge');
                    if (badge) {
                        const visibleCount = allNotifications.filter(canCurrentUserReadNotification).length;
                        badge.innerText = visibleCount;
                        badge.classList.toggle('hidden', visibleCount === 0);
                    }
                }
            } catch (e) { console.warn('local meeting minutes save skipped', e); }
        };

        const sendMeetingMinutesRecord = async (meeting) => {
            if (!meeting || !meeting.title) return showToast('لا يوجد محضر اجتماع لإرساله');
            if (!Array.isArray(meeting.participants) || meeting.participants.length === 0) return showToast('لا يوجد مشاركون لإرسال المحضر لهم');

            const notificationPayload = {
                text: buildMeetingMinutesNoticeText(meeting),
                type: 'normal',
                link: meeting.teamsUrl || '',
                attachment: null,
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                sender: currentUser?.name || meeting.createdBy || 'غير محدد',
                senderId: currentUser?.id || window.auth?.currentUser?.uid || 'unknown',
                senderRole: currentUser?.role || meeting.createdByRole || '',
                recipientIds: meeting.participants.map(p => p.id).filter(Boolean),
                recipientRoles: [...new Set(meeting.participants.map(p => p.role).filter(Boolean))],
                recipientNames: meeting.participants.map(p => p.name).filter(Boolean),
                timestamp: Date.now()
            };

            persistMeetingMinutesLocallyForParticipants(meeting, notificationPayload);

            try {
                if (window.db && window.fs) {
                    await window.fs.addDoc(window.fs.collection(window.db, 'artifacts', window.appId, 'public', 'data', 'notifications'), notificationPayload);
                }
                showToast('تم إرسال محضر الاجتماع للمشاركين ✅');
            } catch (e) {
                console.warn('cloud meeting minutes send skipped', e);
                showToast('تم حفظ الإرسال محلياً، وتعذر الإرسال السحابي مؤقتاً');
            }
        };

        const sendCurrentMeetingMinutesToParticipants = async () => {
            let meeting = getCurrentMeetingDraft();
            if (!meeting.title || meeting.title === 'محضر اجتماع') return showToast('اكتب عنوان الاجتماع قبل الإرسال');
            if (!meeting.participants || meeting.participants.length === 0) return showToast('اختر المشاركين قبل الإرسال');

            if (!currentMeetingForPrint) {
                const items = getStoredMeetings();
                meeting.id = 'meet-' + Date.now();
                meeting.createdAt = Date.now();
                items.unshift(meeting);
                setStoredMeetings(items);
                currentMeetingForPrint = meeting;
                renderMeetingsArchive();
            }
            await sendMeetingMinutesRecord(meeting);
        };

        const sendMeetingMinutesById = async (id) => {
            const meeting = getStoredMeetings().find(m => m.id === id);
            if (!meeting) return showToast('لم يتم العثور على محضر الاجتماع');
            await sendMeetingMinutesRecord(meeting);
        };

        const printCurrentMeeting = () => {
            const m = currentMeetingForPrint || {
                title: document.getElementById('meeting-title').value || 'محضر اجتماع',
                type: document.getElementById('meeting-type').value,
                date: document.getElementById('meeting-date').value,
                time: document.getElementById('meeting-time').value,
                teamsUrl: document.getElementById('meeting-teams-url')?.value || '',
                agenda: document.getElementById('meeting-agenda').value,
                recommendations: document.getElementById('meeting-recommendations').value,
                tasks: document.getElementById('meeting-tasks').value,
                participants: [...document.querySelectorAll('.meeting-participant:checked')].map(cb => ({name: cb.dataset.name, role: cb.dataset.role})),
                chat: meetingChatLines,
                createdBy: currentUser?.name || 'غير محدد'
            };
            const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${m.title}</title><style>
                body{font-family:'Cairo',Arial,sans-serif;padding:35px;color:#0f172a} .head{text-align:center;border-bottom:3px solid #1e7b78;padding-bottom:12px;margin-bottom:22px}
                h1{font-size:22px;margin:0;color:#1e7b78}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:18px 0}.box{border:1px solid #d8dee8;border-radius:14px;padding:12px;margin:10px 0;white-space:pre-wrap}.label{font-weight:800;color:#1e7b78;margin-bottom:6px}.small{font-size:12px;color:#64748b}@media print{button{display:none} body{padding:20px}}
            </style></head><body><div class="head"><div class="small">المملكة العربية السعودية - وزارة التعليم</div><h1>محضر اجتماع</h1><div class="small">منصة المدرسة الرقمية الذكية</div></div>
            <div class="meta"><div class="box"><div class="label">عنوان الاجتماع</div>${m.title || ''}</div><div class="box"><div class="label">نوع الاجتماع</div>${m.type || ''}</div><div class="box"><div class="label">التاريخ</div>${m.date || ''}</div><div class="box"><div class="label">الوقت</div>${m.time || ''}</div></div>
            <div class="box"><div class="label">منشئ الاجتماع</div>${m.createdBy || ''}</div>
            <div class="box"><div class="label">رابط الاجتماع عبر Microsoft Teams</div>${m.teamsUrl ? `<a href="${m.teamsUrl}" target="_blank">اضغط هنا للانضمام عبر Teams</a><br><span class="small">${m.teamsUrl}</span>` : 'لم يتم إضافة رابط Teams'}</div>
            <div class="box"><div class="label">الحضور</div>${(m.participants || []).map(p => (p.name || '') + ' - ' + roleLabel(p.role)).join('<br>')}</div>
            <div class="box"><div class="label">محاور الاجتماع</div>${m.agenda || ''}</div>
            <div class="box"><div class="label">التوصيات والقرارات</div>${m.recommendations || ''}</div>
            <div class="box"><div class="label">المهام الناتجة</div>${m.tasks || ''}</div>
            <div class="box"><div class="label">ملاحظات ودردشة الاجتماع</div>${(m.chat || []).map(c => (c.by || '') + ': ' + (c.text || '')).join('<br>')}</div>
            <br><br><div class="meta"><div>توقيع قائد/ة المدرسة: ....................</div><div>توقيع معد المحضر: ....................</div></div>
            <button onclick="window.print()" style="padding:10px 25px;border:0;border-radius:12px;background:#1e7b78;color:white;font-weight:bold">طباعة</button>


</body></html>`;
            const w = window.open('', '_blank');
            w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
        };


        const showSchoolManagementPanel = async () => {
            const modal = document.getElementById('school-management-modal');
            if (!modal) return showToast('لم يتم العثور على واجهة إدارة المدارس');
            modal.style.display = 'flex';
            await renderSchoolManagement();
        };

        const fillSchoolPanelFromRequest = () => {
            const g = id => (document.getElementById(id)?.value || '').trim();
            const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
            set('sm-school-name', g('school-req-school-name'));
            set('sm-manager-name', g('school-req-manager-name'));
            set('sm-manager-email', g('school-req-email'));
            set('sm-manager-password', g('school-req-password'));
            showToast('تم نقل البيانات إلى نموذج إدارة المدارس');
        };

        const createSupabaseSchoolFromPanel = async () => {
            const schoolName = (document.getElementById('sm-school-name')?.value || '').trim();
            const managerName = (document.getElementById('sm-manager-name')?.value || '').trim();
            const email = (document.getElementById('sm-manager-email')?.value || '').trim();
            const password = (document.getElementById('sm-manager-password')?.value || '').trim();
            const statusBox = document.getElementById('sm-status');
            if (!schoolName || !managerName || !email || !password) { showToast('يرجى تعبئة جميع بيانات المدرسة والمدير'); return; }
            try {
                if (statusBox) statusBox.textContent = 'جاري الحفظ في Supabase...';
                if (!window.SmartSchoolSupabase || !window.SmartSchoolSupabase.createSchoolWithManager) throw new Error('جسر Supabase غير جاهز');
                const result = await window.SmartSchoolSupabase.createSchoolWithManager({ schoolName, managerName, email, password, status:'active' });
                const school = result.school;
                const manager = result.manager;
                const localUsers = collectLocalUsersForWorkspace();
                if (!localUsers.some(u => String(u.email||'').toLowerCase() === String(email).toLowerCase())) {
                    localUsers.push({ ...manager, role:'leadership', isActive:true, status:'active', schoolName:school.schoolName, schoolId:school.id, accountType:'school_manager', isPrimaryManager:true });
                    saveUnifiedUserStores(localUsers);
                    allUsers = localUsers;
                }
                const localSchools = JSON.parse(localStorage.getItem('smart_school_schools') || '[]').filter(s => String(s.id||s.schoolId) !== String(school.id));
                localSchools.push({ id:school.id, schoolId:school.id, schoolName:school.schoolName, managerName:school.managerName, managerEmail:school.managerEmail, status:school.status, registrationLink:school.registrationLink, loginLink:school.loginLink, createdAt:school.createdAt });
                localStorage.setItem('smart_school_schools', JSON.stringify(localSchools));
                ['sm-school-name','sm-manager-name','sm-manager-email','sm-manager-password'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
                if (statusBox) statusBox.textContent = 'تم الحفظ بنجاح في Supabase.';
                showToast('تم إنشاء المدرسة وحفظها في Supabase');
                await renderSchoolManagement();
            } catch (err) {
                console.error('Create school failed:', err);
                if (statusBox) statusBox.textContent = 'فشل الحفظ: ' + (err.message || err);
                showToast('فشل حفظ المدرسة في Supabase: ' + (err.message || err));
            }
        };

        const renderSchoolManagement = async () => {
            const tbody = document.getElementById('schools-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 text-xs">جاري تحميل المدارس من Supabase...</td></tr>';
            try {
                if (!window.SmartSchoolSupabase || !window.SmartSchoolSupabase.listSchools) throw new Error('جسر Supabase غير جاهز');
                const schools = await window.SmartSchoolSupabase.listSchools();
                localStorage.setItem('smart_school_schools', JSON.stringify(schools.map(s => ({ id:s.id, schoolId:s.id, schoolName:s.schoolName, managerName:s.managerName, managerEmail:s.managerEmail, status:s.status, registrationLink:s.registrationLink, loginLink:s.loginLink, createdAt:s.createdAt }))));
                if (!schools.length) {
                    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 text-xs">لا توجد مدارس في Supabase حتى الآن. أنشئ مدرسة من النموذج أعلاه.</td></tr>';
                    return;
                }
                tbody.innerHTML = schools.map(s => {
                    const reg = s.registrationLink || '';
                    const login = s.loginLink || '';
                    const statusLabel = s.status === 'active' ? '<span class="text-green-700 font-bold">مفعلة</span>' : '<span class="text-amber-700 font-bold">'+(s.status||'pending')+'</span>';
                    return `<tr class="hover:bg-slate-50">
                        <td class="p-3 border-b font-bold text-xs text-slate-700">${s.schoolName || 'بدون اسم'}<div class="text-[10px] text-slate-400 font-normal mt-1">${s.schoolCode || s.id}</div></td>
                        <td class="p-3 border-b text-xs text-slate-600">${s.managerName || ''}<div class="text-[10px] text-slate-400 mt-1">${s.managerEmail || ''}</div></td>
                        <td class="p-3 border-b text-center text-xs">${statusLabel}</td>
                        <td class="p-3 border-b text-center"><div class="flex justify-center gap-2 flex-wrap">
                            <button onclick="copyTextValue('${safeJs(reg)}','تم نسخ رابط التسجيل')" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">رابط التسجيل</button>
                            <button onclick="copyTextValue('${safeJs(login)}','تم نسخ رابط الدخول')" class="bg-teal-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold">رابط الدخول</button>
                            <button onclick="toggleSchoolSupabaseStatus('${safeJs(s.id)}','${s.status === 'active' ? 'disabled' : 'active'}')" class="bg-amber-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">${s.status === 'active' ? 'تعطيل' : 'تفعيل'}</button>
                            <button onclick="deleteSupabaseSchool('${safeJs(s.id)}')" class="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">حذف</button>
                        </div></td>
                    </tr>`;
                }).join('');
            } catch (err) {
                console.error('Load schools failed:', err);
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-red-500 text-xs">تعذر تحميل المدارس من Supabase: '+(err.message || err)+'</td></tr>';
            }
        };

        const copyTextValue = async (text, msg) => {
            if (!text) return showToast('لا يوجد رابط للنسخ');
            try { await navigator.clipboard.writeText(text); showToast(msg || 'تم النسخ'); }
            catch(e){ prompt('انسخ الرابط:', text); }
        };

        const toggleSchoolSupabaseStatus = async (schoolId, status) => {
            try {
                await window.SmartSchoolSupabase.updateSchoolStatus(schoolId, status);
                showToast(status === 'active' ? 'تم تفعيل المدرسة' : 'تم تعطيل المدرسة');
                await renderSchoolManagement();
            } catch (err) { showToast('تعذر تحديث حالة المدرسة: ' + (err.message || err)); }
        };

        const deleteSupabaseSchool = async (schoolId) => {
            if (!confirm('سيتم حذف المدرسة من Supabase مع المستخدمين المرتبطين بها إذا كانت العلاقات مفعلة. هل تريد المتابعة؟')) return;
            try {
                await window.SmartSchoolSupabase.deleteSchool(schoolId);
                showToast('تم حذف المدرسة');
                await renderSchoolManagement();
            } catch (err) { showToast('تعذر حذف المدرسة: ' + (err.message || err)); }
        };

        try { window.showSchoolManagementPanel = showSchoolManagementPanel; window.renderSchoolManagement = renderSchoolManagement; window.createSupabaseSchoolFromPanel = createSupabaseSchoolFromPanel; window.fillSchoolPanelFromRequest = fillSchoolPanelFromRequest; window.copyTextValue = copyTextValue; window.toggleSchoolSupabaseStatus = toggleSchoolSupabaseStatus; window.deleteSupabaseSchool = deleteSupabaseSchool; } catch(e) {}

        const logout = () => { localStorage.clear(); location.reload(); };
        const closeModal = (id) => document.getElementById(id).style.display = 'none';
        const closeApp = () => { document.getElementById('main-ui').style.display = 'flex'; document.querySelectorAll('.app-iframe-container').forEach(v => v.classList.remove('active')); document.getElementById('backBtn').classList.remove('visible'); };
        
        window.onload = () => { 
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('mode') === 'register') {
                const currentPath = window.location.href.split('?')[0];
                const registerPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'register.html';
                const params = new URLSearchParams();
                ['admin','token','schoolId','schoolName'].forEach(k => { if (urlParams.get(k)) params.set(k, urlParams.get(k)); });
                window.location.replace(registerPath + '?' + params.toString());
                return;
            } else {
                checkUserStatus();
            } 
        };
    

;

/* extracted inline script 3 */

(function(){
  'use strict';
  if (window.__meetingApprovalFinalV1) return;
  window.__meetingApprovalFinalV1 = true;

  function q(id){ return document.getElementById(id); }
  function toast(msg){ try{ if(typeof window.showToast==='function') window.showToast(msg); else alert(msg); }catch(e){ alert(msg); } }
  function userRole(){ return (window.currentUser && window.currentUser.role) || localStorage.getItem('currentRole') || 'general'; }
  function userName(){ return (window.currentUser && window.currentUser.name) || localStorage.getItem('currentUserName') || 'غير محدد'; }
  function roleTitle(){ var r=userRole(); return r==='leadership'?'المدير':(r==='agent'?'الوكيل':'المعلم'); }
  function storageKey(){ return 'smart_school_meeting_approval_defaults_' + userRole(); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function lines(t){ return String(t||'').split(/\n|،|؛/).map(function(x){return x.trim();}).filter(Boolean); }
  function today(){ try{return new Date().toISOString().slice(0,10);}catch(e){return '';} }
  function readFileAsDataUrl(file){
    return new Promise(function(resolve){
      if(!file) return resolve('');
      var fr=new FileReader();
      fr.onload=function(){ resolve(fr.result || ''); };
      fr.onerror=function(){ resolve(''); };
      fr.readAsDataURL(file);
    });
  }
  function defaultSettings(){
    return {
      schoolName: localStorage.getItem('smart_school_name') || '',
      managerName: localStorage.getItem('smart_manager_name') || '',
      deputyName: localStorage.getItem('smart_deputy_name') || '',
      includeManagerSignature:true,
      includeDeputySignature:false,
      includeSeal:true,
      includeQr:true,
      includeAttendance:true,
      archive:true,
      send:true,
      createPdf:true,
      approveRecommendations:true,
      aiPolish:true,
      managerSignature:'',
      deputySignature:'',
      schoolSeal:''
    };
  }
  function getSettings(){
    try{ return Object.assign(defaultSettings(), JSON.parse(localStorage.getItem(storageKey())||'{}')); }
    catch(e){ return defaultSettings(); }
  }
  function saveSettings(s){ localStorage.setItem(storageKey(), JSON.stringify(s||{})); }
  function setChecked(id,val){ var el=q(id); if(el) el.checked=!!val; }
  function setVal(id,val){ var el=q(id); if(el) el.value=val||''; }
  function getChecked(id){ var el=q(id); return !!(el && el.checked); }
  function getVal(id){ var el=q(id); return (el && el.value || '').trim(); }

  function createApprovalModal(){
    if(q('meeting-approval-modal')) return;
    var div=document.createElement('div');
    div.id='meeting-approval-modal';
    div.className='modal';
    div.innerHTML = ''+
    '<div class="modal-content max-w-6xl text-right">'+
      '<div class="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-5">'+
        '<div><h3 class="text-xl font-extrabold text-slate-800">📋 المراجعة النهائية لمحضر الاجتماع</h3><p class="text-[11px] text-slate-500 font-bold mt-1">راجع خيارات الاعتماد قبل الطباعة أو الإرسال، ويمكن حفظها كإعداد افتراضي لكل محاضر '+esc(roleTitle())+'.</p></div>'+
        '<div class="flex gap-2"><button onclick="closeMeetingApprovalModal()" class="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold">إغلاق</button></div>'+
      '</div>'+
      '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">'+
        '<div class="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-3xl p-4">'+
          '<h4 class="font-extrabold text-slate-700 mb-3">بيانات الاعتماد</h4>'+
          '<input id="approval-school-name" class="w-full p-3 border rounded-xl text-sm mb-2" placeholder="اسم المدرسة">'+
          '<input id="approval-manager-name" class="w-full p-3 border rounded-xl text-sm mb-2" placeholder="اسم المدير/ة">'+
          '<input id="approval-deputy-name" class="w-full p-3 border rounded-xl text-sm mb-3" placeholder="اسم الوكيل/ة - اختياري">'+
          '<label class="block bg-white border rounded-xl p-3 mb-2"><span class="text-xs font-bold text-slate-600">🖋️ توقيع المدير/ة</span><input id="approval-manager-signature" type="file" accept="image/*" class="w-full mt-2 text-xs"></label>'+
          '<label class="block bg-white border rounded-xl p-3 mb-2"><span class="text-xs font-bold text-slate-600">🖋️ توقيع الوكيل/ة</span><input id="approval-deputy-signature" type="file" accept="image/*" class="w-full mt-2 text-xs"></label>'+
          '<label class="block bg-white border rounded-xl p-3 mb-3"><span class="text-xs font-bold text-slate-600">🏫 ختم المدرسة</span><input id="approval-school-seal" type="file" accept="image/*" class="w-full mt-2 text-xs"></label>'+
          '<div class="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-[11px] text-amber-800 leading-6">إذا حفظت الخيارات كإعداد افتراضي فستُطبق تلقائيًا على كل محضر جديد ينشئه '+esc(roleTitle())+'.</div>'+
        '</div>'+
        '<div class="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-4">'+
          '<h4 class="font-extrabold text-slate-700 mb-3">خيارات المحضر</h4>'+
          '<div class="space-y-2 text-sm text-slate-700">'+
            checkboxHtml('approval-include-manager-signature','إضافة توقيع المدير')+
            checkboxHtml('approval-include-deputy-signature','إضافة توقيع الوكيل')+
            checkboxHtml('approval-include-seal','إضافة ختم المدرسة')+
            checkboxHtml('approval-include-qr','توليد QR / رمز تحقق للمحضر')+
            checkboxHtml('approval-include-attendance','إضافة صفحة سجل الحضور')+
            checkboxHtml('approval-archive','حفظ المحضر في أرشيف ومحفظة الاجتماعات')+
            checkboxHtml('approval-send','إرسال المحضر للمشاركين')+
            checkboxHtml('approval-create-pdf','اعتماد نسخة رسمية للطباعة PDF')+
            checkboxHtml('approval-approve-recommendations','اعتماد التوصيات والقرارات')+
            checkboxHtml('approval-ai-polish','تحسين الصياغة رسميًا قبل الاعتماد')+
          '</div>'+
          '<div class="grid grid-cols-1 gap-2 mt-4">'+
            '<button onclick="saveMeetingApprovalAsDefault()" class="bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold">💾 حفظ كإعداد افتراضي</button>'+
            '<button onclick="applyMeetingApprovalAndPrint()" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold">🖨️ اعتماد وطباعة</button>'+
            '<button onclick="applyMeetingApprovalAndSend()" class="bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold">📤 اعتماد وإرسال للمشاركين</button>'+
          '</div>'+
        '</div>'+
        '<div class="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-3xl p-4">'+
          '<h4 class="font-extrabold text-slate-700 mb-3">معاينة سريعة قبل الاعتماد</h4>'+
          '<div id="meeting-approval-preview" class="bg-white border rounded-2xl p-3 text-xs text-slate-700 leading-6 max-h-[500px] overflow-y-auto"></div>'+
        '</div>'+
      '</div>'+
    '</div>';
    document.body.appendChild(div);
  }
  function checkboxHtml(id,label){ return '<label class="flex items-center gap-2 bg-slate-50 border rounded-xl p-2"><input id="'+id+'" type="checkbox" class="w-4 h-4"><span class="font-bold">'+esc(label)+'</span></label>'; }

  function getDraftSafe(){
    try{ if(typeof window.getCurrentMeetingDraft==='function') return window.getCurrentMeetingDraft(); }catch(e){}
    var selected=[].slice.call(document.querySelectorAll('.meeting-participant:checked'));
    return {
      id:'meet-draft-'+Date.now(),
      title:(q('meeting-title')&&q('meeting-title').value.trim())||'محضر اجتماع',
      type:(q('meeting-type')&&q('meeting-type').value)||'',
      date:(q('meeting-date')&&q('meeting-date').value)||today(),
      time:(q('meeting-time')&&q('meeting-time').value)||'',
      teamsUrl:(q('meeting-teams-url')&&q('meeting-teams-url').value.trim())||'',
      agenda:(q('meeting-agenda')&&q('meeting-agenda').value.trim())||'',
      recommendations:(q('meeting-recommendations')&&q('meeting-recommendations').value.trim())||'',
      tasks:(q('meeting-tasks')&&q('meeting-tasks').value.trim())||'',
      participants:selected.map(function(cb){return {id:cb.value,name:cb.dataset.name,role:cb.dataset.role};}),
      createdBy:userName(), createdByRole:userRole(), createdAt:Date.now()
    };
  }
  function polishText(t){
    var arr=lines(t);
    if(!arr.length) return t||'';
    return arr.map(function(x,i){
      x=x.replace(/^[-\d\.\s]+/,'').trim();
      return (i+1)+'- '+x;
    }).join('\n');
  }
  async function collectSettingsFromModal(){
    var old=getSettings();
    var s=Object.assign({}, old, {
      schoolName:getVal('approval-school-name'), managerName:getVal('approval-manager-name'), deputyName:getVal('approval-deputy-name'),
      includeManagerSignature:getChecked('approval-include-manager-signature'), includeDeputySignature:getChecked('approval-include-deputy-signature'), includeSeal:getChecked('approval-include-seal'), includeQr:getChecked('approval-include-qr'), includeAttendance:getChecked('approval-include-attendance'), archive:getChecked('approval-archive'), send:getChecked('approval-send'), createPdf:getChecked('approval-create-pdf'), approveRecommendations:getChecked('approval-approve-recommendations'), aiPolish:getChecked('approval-ai-polish')
    });
    var ms=q('approval-manager-signature'), ds=q('approval-deputy-signature'), ss=q('approval-school-seal');
    if(ms && ms.files && ms.files[0]) s.managerSignature=await readFileAsDataUrl(ms.files[0]);
    if(ds && ds.files && ds.files[0]) s.deputySignature=await readFileAsDataUrl(ds.files[0]);
    if(ss && ss.files && ss.files[0]) s.schoolSeal=await readFileAsDataUrl(ss.files[0]);
    localStorage.setItem('smart_school_name', s.schoolName||'');
    localStorage.setItem('smart_manager_name', s.managerName||'');
    localStorage.setItem('smart_deputy_name', s.deputyName||'');
    return s;
  }
  function loadSettingsToModal(){
    var s=getSettings();
    setVal('approval-school-name',s.schoolName); setVal('approval-manager-name',s.managerName); setVal('approval-deputy-name',s.deputyName);
    setChecked('approval-include-manager-signature',s.includeManagerSignature); setChecked('approval-include-deputy-signature',s.includeDeputySignature); setChecked('approval-include-seal',s.includeSeal); setChecked('approval-include-qr',s.includeQr); setChecked('approval-include-attendance',s.includeAttendance); setChecked('approval-archive',s.archive); setChecked('approval-send',s.send); setChecked('approval-create-pdf',s.createPdf); setChecked('approval-approve-recommendations',s.approveRecommendations); setChecked('approval-ai-polish',s.aiPolish);
    updateApprovalPreview();
  }
  function updateApprovalPreview(){
    var m=getDraftSafe(), box=q('meeting-approval-preview'); if(!box) return;
    var s=getSettings();
    box.innerHTML='<div class="font-extrabold text-teal-800 mb-2">'+esc(m.title||'محضر اجتماع')+'</div>'+
      '<div><b>النوع:</b> '+esc(m.type||'')+'</div><div><b>التاريخ:</b> '+esc(m.date||'')+' '+esc(m.time||'')+'</div>'+
      '<div><b>المنشئ:</b> '+esc(m.createdBy||userName())+'</div><div><b>المدرسة:</b> '+esc(getVal('approval-school-name')||s.schoolName||'غير محدد')+'</div>'+
      '<hr class="my-2"><div><b>المشاركون:</b> '+esc((m.participants||[]).map(function(p){return p.name;}).join('، ')||'لم يتم التحديد')+'</div>'+
      '<hr class="my-2"><div class="whitespace-pre-wrap"><b>جدول الأعمال:</b><br>'+esc(m.agenda||'')+'</div>'+
      '<hr class="my-2"><div class="whitespace-pre-wrap"><b>التوصيات:</b><br>'+esc(m.recommendations||'')+'</div>'+
      '<hr class="my-2"><div class="text-[11px] text-slate-500">سيتم تطبيق الخيارات المحددة عند الاعتماد والطباعة أو الإرسال.</div>';
  }
  function ensureMeetingArchived(m){
    try{
      if(typeof window.getStoredMeetings==='function' && typeof window.setStoredMeetings==='function'){
        var items=window.getStoredMeetings()||[];
        if(!items.some(function(x){return x.id===m.id;})){ items.unshift(m); window.setStoredMeetings(items); }
      } else {
        var key='smart_school_meetings_archive'; var arr=JSON.parse(localStorage.getItem(key)||'[]');
        if(!arr.some(function(x){return x.id===m.id;})){ arr.unshift(m); localStorage.setItem(key, JSON.stringify(arr)); }
      }
      if(typeof window.renderMeetingsArchive==='function') window.renderMeetingsArchive();
      if(typeof window.renderMeetingPortfolio==='function') window.renderMeetingPortfolio();
    }catch(e){ console.warn(e); }
  }
  function makeVerificationCode(m){
    var raw=(m.id||'')+(m.title||'')+(m.date||'')+(m.createdAt||''); var h=0;
    for(var i=0;i<raw.length;i++){ h=((h<<5)-h)+raw.charCodeAt(i); h|=0; }
    return 'MTG-'+Math.abs(h).toString(36).toUpperCase()+'-'+(m.date||today()).replace(/-/g,'');
  }
  function pseudoQrSvg(code){
    var n=13, size=104, cell=8, h=0; for(var i=0;i<code.length;i++){h=(h*31+code.charCodeAt(i))>>>0;}
    var rects='';
    for(var y=0;y<n;y++) for(var x=0;x<n;x++){
      var finder=(x<4&&y<4)||(x>8&&y<4)||(x<4&&y>8);
      var on=finder || (((h + x*17 + y*29 + (x*y)) % 5) < 2);
      if(on) rects+='<rect x="'+(x*cell)+'" y="'+(y*cell)+'" width="'+cell+'" height="'+cell+'"/>';
    }
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><g fill="#0f766e">'+rects+'</g></svg>';
  }
  function approvedMeetingFromDraft(s){
    var m=getDraftSafe();
    if(!m.id || m.id.indexOf('draft')>-1) m.id='meet-'+Date.now();
    m.createdAt=m.createdAt||Date.now();
    m.createdBy=m.createdBy||userName(); m.createdByRole=m.createdByRole||userRole();
    if(s.aiPolish){ m.agenda=polishText(m.agenda); m.recommendations=polishText(m.recommendations); m.tasks=polishText(m.tasks); }
    m.approvalSettings=s; m.approvedAt=Date.now(); m.approvedBy=userName(); m.verificationCode=makeVerificationCode(m); m.approvalStatus='approved';
    return m;
  }
  function officialMinutesHtml(m){
    var s=m.approvalSettings || getSettings(), code=m.verificationCode||makeVerificationCode(m);
    var agenda=lines(m.agenda).length?lines(m.agenda):['']; var rec=lines(m.recommendations).length?lines(m.recommendations):['']; var tasks=lines(m.tasks).length?lines(m.tasks):[''];
    var participants=(m.participants||[]);
    var rows=''; for(var i=0;i<36;i++){ var p=participants[i]||{}; rows+='<tr><td>'+(i+1)+'</td><td>'+esc(p.name||'')+'</td><td></td></tr>'; }
    var seal=s.includeSeal && s.schoolSeal ? '<img class="seal" src="'+s.schoolSeal+'">' : '<div class="sealBox">ختم المدرسة</div>';
    var mgrSig=s.includeManagerSignature && s.managerSignature ? '<img class="sig" src="'+s.managerSignature+'">' : '<div class="sigLine"></div>';
    var depSig=s.includeDeputySignature && s.deputySignature ? '<img class="sig" src="'+s.deputySignature+'">' : '<div class="sigLine"></div>';
    var qr=s.includeQr ? '<div class="qr">'+pseudoQrSvg(code)+'<div class="code">'+esc(code)+'</div></div>' : '';
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>محضر اجتماع معتمد</title><style>'+printCss()+'</style></head><body>'+
      '<section class="page">'+
        '<div class="topbar"></div><header><div class="hblock"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><span>إدارة التعليم</span><span>'+esc(s.schoolName||'المدرسة')+'</span></div><div class="logo">وزارة التعليم<br><small>Ministry of Education</small></div><div class="meta"><div>اليوم: '+esc(dayName(m.date))+'</div><div>التاريخ: '+esc(m.date||today())+'</div><div>الوقت: '+esc(m.time||'')+'</div></div></header>'+
        '<h1>محضر اجتماع</h1><p class="basmala">بسم الله والحمد لله والصلاة والسلام على رسول الله وعلى آله وصحبه وسلم، أما بعد:</p>'+
        '<div class="grid2"><div class="field">برئاسة: '+esc(m.createdBy||userName())+'</div><div class="field">نوع الاجتماع: '+esc(m.type||'')+'</div><div class="field">رقم الاجتماع: '+esc((m.id||'').replace(/meet-/,'') )+'</div><div class="field">عبر: Microsoft Teams</div></div>'+
        '<div class="notice">تم عقد الاجتماع بتاريخ <b>'+esc(m.date||'')+'</b> الساعة <b>'+esc(m.time||'')+'</b> بحضور الفئة المستهدفة وعددهم <b>'+participants.length+'</b> مشارك/ـة.</div>'+
        '<h2>جدول الأعمال</h2><ol>'+agenda.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+
        '<h2>القرارات والتوصيات</h2><ol>'+rec.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+
        '<h2>المهام الناتجة عن الاجتماع</h2><ol>'+tasks.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+
        '<div class="teams">رابط Teams: '+esc(m.teamsUrl||'غير مرفق')+'</div>'+
        '<footer><div><b>اسم المدير/ة</b><br>'+esc(s.managerName||m.createdBy||'')+'<br>'+mgrSig+'</div>'+(s.includeDeputySignature?'<div><b>اسم الوكيل/ة</b><br>'+esc(s.deputyName||'')+'<br>'+depSig+'</div>':'')+'<div>'+seal+'</div>'+qr+'</footer>'+
        '<div class="footnote">منصة المدرسة الرقمية الذكية - محضر معتمد بتاريخ '+esc(today())+'</div>'+
      '</section>'+
      (s.includeAttendance?'<section class="page"><div class="topbar"></div><header><div class="hblock"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><span>'+esc(s.schoolName||'المدرسة')+'</span></div><div class="logo">وزارة التعليم</div><div class="meta"><div>'+esc(m.date||today())+'</div></div></header><h1>سجل الحضور والتوثيق</h1><table><thead><tr><th>م</th><th>الاسم</th><th>التوقيع</th></tr></thead><tbody>'+rows+'</tbody></table><div class="note">ملاحظة: يلزم توقيع الحاضرين/ات فور انتهاء الاجتماع وتوثيق المحضر رسميًا.</div><div class="footnote">منصة المدرسة الرقمية الذكية - تاريخ التحقق: '+esc(today())+' - '+esc(code)+'</div></section>':'')+
    '\n</body></html>';
  }
  function printCss(){ return '@page{size:A4;margin:0}*{box-sizing:border-box}body{font-family:Cairo,Arial,sans-serif;margin:0;color:#0f172a;background:#f8fafc}.page{width:210mm;min-height:297mm;background:white;margin:0 auto;padding:14mm 12mm;position:relative;page-break-after:always}.topbar{position:absolute;top:0;left:0;right:0;height:8px;background:#08783f}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5e7eb;padding-bottom:12px}.hblock{line-height:1.8;color:#065f46;font-size:15px;display:flex;flex-direction:column}.logo{text-align:center;color:#059669;font-weight:800}.logo small{font-size:10px;color:#64748b}.meta{font-size:12px;line-height:2;background:#ecfdf5;border-radius:12px;padding:8px 16px;min-width:140px}h1{text-align:center;color:#047857;font-size:28px;margin:16px 0 10px}h2{color:#047857;font-size:15px;margin:13px 0 7px}.basmala{text-align:center;font-size:13px;color:#475569}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.field,.notice,.teams{background:#f0fdf4;border:1px solid #d1fae5;border-radius:13px;padding:9px;font-size:13px}.notice{line-height:2}.teams{direction:ltr;text-align:left;word-break:break-all;font-size:11px}ol{margin:0;padding:0 24px;background:#fbfffd;border:1px dashed #bbf7d0;border-radius:12px;min-height:32px}li{padding:4px 0;font-size:13px;line-height:1.7}footer{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;margin-top:18px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:12px}.sig{max-width:120px;max-height:55px;object-fit:contain}.sigLine{width:120px;height:40px;border-bottom:1px solid #334155}.seal{width:90px;height:90px;object-fit:contain}.sealBox{width:90px;height:90px;border:2px dashed #94a3b8;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:800;font-size:11px}.qr{text-align:center;font-size:10px}.qr svg{border:1px solid #d1fae5}.code{direction:ltr;font-weight:800;color:#047857}.footnote{position:absolute;bottom:9mm;left:12mm;right:12mm;border-top:1px solid #edf2f7;padding-top:6px;color:#047857;font-weight:700;font-size:11px}.note{margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px;text-align:center;color:#92400e;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#08783f;color:white;padding:8px;font-size:13px}td{border:1px solid #e5e7eb;height:24px;padding:4px;font-size:12px}td:first-child{width:35px;text-align:center}@media print{body{background:white}.page{margin:0;box-shadow:none}}'; }
  function dayName(dateStr){ try{ var d=dateStr?new Date(dateStr):new Date(); return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][d.getDay()]||'';}catch(e){return '';} }
  function printApprovedMeeting(m){ var w=window.open('','_blank'); if(!w){toast('يرجى السماح بالنوافذ المنبثقة للطباعة'); return;} w.document.open(); w.document.write(officialMinutesHtml(m)); w.document.close(); w.focus(); setTimeout(function(){ try{w.print();}catch(e){} },500); }

  var originalPrint = window.printCurrentMeeting;
  var originalSendCurrent = window.sendCurrentMeetingMinutesToParticipants;
  var originalSendRecord = window.sendMeetingMinutesRecord;

  window.openMeetingApprovalReview=function(){ createApprovalModal(); loadSettingsToModal(); var m=q('meeting-approval-modal'); if(m) m.style.display='flex'; };
  window.closeMeetingApprovalModal=function(){ var m=q('meeting-approval-modal'); if(m)m.style.display='none'; };
  window.saveMeetingApprovalAsDefault=async function(){ var s=await collectSettingsFromModal(); saveSettings(s); toast('تم حفظ إعدادات محاضر الاجتماعات كإعداد افتراضي ✅'); updateApprovalPreview(); };
  window.applyMeetingApprovalAndPrint=async function(){ var s=await collectSettingsFromModal(); var m=approvedMeetingFromDraft(s); if(s.archive) ensureMeetingArchived(m); window.currentMeetingForPrint=m; printApprovedMeeting(m); toast('تم اعتماد المحضر وتجهيزه للطباعة ✅'); };
  window.applyMeetingApprovalAndSend=async function(){
    var s=await collectSettingsFromModal(); if(!s.send){ toast('خيار الإرسال غير مفعّل في المراجعة النهائية'); return; }
    var m=approvedMeetingFromDraft(s);
    if(!m.title || m.title==='محضر اجتماع') return toast('اكتب عنوان الاجتماع قبل الاعتماد');
    if(!m.participants || !m.participants.length) return toast('اختر المشاركين قبل الإرسال');
    if(s.archive) ensureMeetingArchived(m); window.currentMeetingForPrint=m;
    if(typeof originalSendRecord==='function') await originalSendRecord(m); else if(typeof originalSendCurrent==='function') await originalSendCurrent();
    toast('تم اعتماد محضر الاجتماع وإرساله للمشاركين ✅');
    window.closeMeetingApprovalModal();
  };
  window.printCurrentMeeting=function(){
    var m=window.currentMeetingForPrint || getDraftSafe();
    if(m && m.approvalSettings){ printApprovedMeeting(m); return; }
    window.openMeetingApprovalReview();
  };
  window.sendCurrentMeetingMinutesToParticipants=function(){ window.openMeetingApprovalReview(); };

  function enhanceButtons(){
    createApprovalModal();
    var printBtn=[].slice.call(document.querySelectorAll('button')).find(function(b){return (b.textContent||'').indexOf('طباعة المحضر')>-1;});
    if(printBtn && !q('meeting-approval-open-btn')){
      var btn=document.createElement('button');
      btn.id='meeting-approval-open-btn'; btn.type='button'; btn.onclick=window.openMeetingApprovalReview;
      btn.className='bg-amber-600 text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow';
      btn.textContent='📋 مراجعة واعتماد المحضر';
      printBtn.parentNode.insertBefore(btn, printBtn.nextSibling);
    }
    var sendBtn=[].slice.call(document.querySelectorAll('button')).find(function(b){return (b.textContent||'').indexOf('إرسال محضر الاجتماع للمشاركين')>-1;});
    if(sendBtn) sendBtn.onclick=window.openMeetingApprovalReview;
    ['approval-school-name','approval-manager-name','approval-deputy-name'].forEach(function(id){ var el=q(id); if(el) el.oninput=updateApprovalPreview; });
    [].slice.call(document.querySelectorAll('#meeting-approval-modal input[type=checkbox]')).forEach(function(el){ el.onchange=updateApprovalPreview; });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', enhanceButtons); else setTimeout(enhanceButtons,100);
})();


;

/* extracted inline script 4 */

/* تنظيف الأزرار العلوية: يمنع تكرار الزر نفسه داخل الشريط الواحد دون تغيير وظائف الأقسام */
(function(){
  function cleanToolbar(toolbar){
    if(!toolbar) return;
    const seen = new Set();
    toolbar.querySelectorAll('button').forEach(btn=>{
      const label = (btn.textContent||'').replace(/\s+/g,' ').trim();
      const action = btn.getAttribute('onclick') || '';
      const key = label + '|' + action;
      if(seen.has(key)) btn.remove(); else seen.add(key);
    });
  }
  function cleanAllToolbars(){
    document.querySelectorAll('[data-platform-toolbar="1"]').forEach(cleanToolbar);
  }
  document.addEventListener('DOMContentLoaded', cleanAllToolbars);
  window.addEventListener('load', cleanAllToolbars);
  window.cleanDuplicateTopButtons = cleanAllToolbars;
})();


;

/* extracted inline script 5 */

(function(){
  function clearVisibleLoginFields(){
    ['user-display-name','user-madrasati-email'].forEach(function(id){
      var el=document.getElementById(id);
      if(el){
        el.value='';
        el.defaultValue='';
        el.removeAttribute('value');
        el.setAttribute('autocomplete','off');
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    clearVisibleLoginFields();
    setTimeout(clearVisibleLoginFields,200);
    setTimeout(clearVisibleLoginFields,800);
  });
  window.addEventListener('pageshow', clearVisibleLoginFields);
})();


;

/* extracted inline script 6 */

(function(){
  if(window.SmartSchoolCloudStorageLoaded) return;
  window.SmartSchoolCloudStorageLoaded=true;
  var NS='smartSchoolCloudStorage';
  var APP_FOLDER='منصة المدرسة الرقمية الذكية';
  var EXCLUDED_NAMES=['تقرير جديد','التقرير الجديد','داشبورد المتابعة','dashboard','new-report','main-report-app','stats-view'];
  function role(){
    var p=(location.pathname||'').toLowerCase();
    if(p.indexOf('manager')>-1) return 'manager';
    if(p.indexOf('agent')>-1) return 'agent';
    if(p.indexOf('teacher')>-1) return 'teacher';
    return localStorage.getItem(NS+'_role')||'main';
  }
  var roleName={manager:'المدير',agent:'الوكيل',teacher:'المعلم',main:'الرئيسية'};
  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v));window.dispatchEvent(new Event('smartSchoolDataChanged'));}
  function settings(){return read(NS+'_settings_'+role(),{provider:'platform',label:'حفظ داخل المنصة',lastSync:null,linked:false,cloudRoot:APP_FOLDER});}
  function setSettings(s){write(NS+'_settings_'+role(),Object.assign(settings(),s));updateStatus();}
  function toast(msg){var old=document.querySelector('.ss-cloud-toast'); if(old)old.remove(); var el=document.createElement('div'); el.className='ss-cloud-toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(function(){el.remove();},4500);}
  function isExcludedText(txt){txt=(txt||'').toString().toLowerCase(); return EXCLUDED_NAMES.some(function(x){return txt.indexOf(x.toLowerCase())>-1;});}
  function folderStructure(){
    var r=roleName[role()]||'مستخدم';
    return {
      root:APP_FOLDER,
      role:r,
      excluded:['تقرير جديد','داشبورد المتابعة'],
      folders:[
        APP_FOLDER+'/الأرشيف الذكي/'+r,
        APP_FOLDER+'/الأرشيف الذكي/'+r+'/تقارير محفوظة',
        APP_FOLDER+'/الأرشيف الذكي/'+r+'/ملفات مرفقة',
        APP_FOLDER+'/محاضر الاجتماعات/'+r+'/الواردة',
        APP_FOLDER+'/محاضر الاجتماعات/'+r+'/الصادرة',
        APP_FOLDER+'/التنبيهات/'+r+'/الواردة',
        APP_FOLDER+'/التنبيهات/'+r+'/الصادرة',
        APP_FOLDER+'/إعدادات ومزامنة/'+r
      ],
      updatedAt:new Date().toISOString()
    };
  }
  function collectLocalData(){
    var data={archives:[],meetings:[],notifications:[],attachments:[],settings:settings(),meta:{role:role(),roleName:roleName[role()]||'مستخدم',createdAt:new Date().toISOString(),rootFolder:APP_FOLDER,excluded:['تقرير جديد','داشبورد المتابعة']}};
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i); if(!k || isExcludedText(k)) continue;
      var v=localStorage.getItem(k); if(isExcludedText(v)) continue;
      var item={key:k,value:v};
      if(/meeting|محضر|اجتماع/i.test(k+v)) data.meetings.push(item);
      else if(/notif|تنبيه|notification/i.test(k+v)) data.notifications.push(item);
      else if(/archive|أرشيف|pdf|file|record|سجل|محفظة/i.test(k+v)) data.archives.push(item);
    }
    return data;
  }
  function buildCloudPackage(extra){
    var s=settings();
    return {
      packageName:APP_FOLDER,
      provider:s.provider,
      providerLabel:s.label,
      targetFolder:APP_FOLDER,
      mode:'نسخة مطابقة للأقسام داخل التطبيق مع استثناء تقرير جديد وداشبورد المتابعة',
      structure:folderStructure(),
      data:collectLocalData(),
      uploadedFile:extra||null,
      note:'هذه نسخة محلية جاهزة للرفع. الرفع التلقائي المباشر إلى OneDrive/Google Drive يحتاج تفعيل Microsoft Graph API أو Google Drive API عند النشر السحابي.'
    };
  }
  function saveCloudRecord(type,data){
    var key=NS+'_records_'+role();
    var arr=read(key,[]);
    arr.unshift(Object.assign({id:'cloud_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),type:type,role:role(),provider:settings().provider,appFolder:APP_FOLDER,createdAt:new Date().toISOString()},data||{}));
    write(key,arr);
    return arr[0];
  }
  function updateStatus(){
    var st=document.getElementById('ssCloudStatus'); if(!st) return;
    var s=settings();
    st.innerHTML='الحالة: <b>'+s.label+'</b><br>المجلد الرئيسي في السحابة: <b>'+APP_FOLDER+'</b><br>الاستثناءات: <b>تقرير جديد، داشبورد المتابعة</b><br>آخر مزامنة: '+(s.lastSync?new Date(s.lastSync).toLocaleString('ar-SA'):'لم تتم بعد');
  }
  function choose(provider,label){
    if(provider==='onedrive'){
      setSettings({provider:provider,label:label,linked:true,cloudRoot:APP_FOLDER});
      toast('تم اختيار OneDrive. سيتم تجهيز النسخ داخل مجلد: '+APP_FOLDER);
    }else if(provider==='gdrive'){
      setSettings({provider:provider,label:label,linked:true,cloudRoot:APP_FOLDER});
      toast('تم اختيار Google Drive. سيتم تجهيز النسخ داخل مجلد: '+APP_FOLDER);
    }else if(provider==='platform'){
      setSettings({provider:provider,label:label,linked:false,cloudRoot:APP_FOLDER});
      toast('تم اختيار الحفظ داخل المنصة.');
    }else{
      setSettings({provider:provider,label:'تخطي الآن',linked:false});
      toast('تم تخطي الربط السحابي الآن.');
    }
    closeMenu();
  }
  function syncNow(){
    var pkg=buildCloudPackage();
    write(NS+'_syncPackage_'+role(),pkg);
    write(NS+'_syncMap_'+role(),pkg.structure);
    setSettings({lastSync:new Date().toISOString(),cloudRoot:APP_FOLDER});
    saveCloudRecord('cloud-package',{title:'نسخة مطابقة - '+(roleName[role()]||'مستخدم'),targetFolder:APP_FOLDER,excluded:pkg.structure.excluded,folders:pkg.structure.folders});
    toast('تم تجهيز نسخة مطابقة باسم '+APP_FOLDER+' مع استثناء تقرير جديد وداشبورد المتابعة.');
  }
  function downloadJson(filename,obj){
    var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(a.href);},500);
  }
  function downloadMap(){
    var data=read(NS+'_syncMap_'+role(),folderStructure());
    downloadJson('خريطة_مجلدات_'+APP_FOLDER.replace(/\s+/g,'_')+'_'+role()+'.json',data);
  }
  function downloadPackage(){
    var pkg=buildCloudPackage();
    write(NS+'_syncPackage_'+role(),pkg);
    downloadJson(APP_FOLDER.replace(/\s+/g,'_')+'_نسخة_مطابقة_'+role()+'.json',pkg);
    toast('تم تنزيل ملف النسخة المطابقة الجاهز للرفع إلى السحابة المحددة.');
  }
  function uploadSelectedFile(file){
    if(!file) return;
    var rec={name:file.name,size:file.size,type:file.type||'غير محدد',targetFolder:APP_FOLDER+'/الأرشيف الذكي/'+(roleName[role()]||'مستخدم')+'/ملفات مرفقة',excluded:['تقرير جديد','داشبورد المتابعة']};
    var reader=new FileReader();
    reader.onload=function(){
      rec.dataUrl=reader.result;
      saveCloudRecord('uploaded-file',rec);
      write(NS+'_lastUploaded_'+role(),rec);
      setSettings({lastSync:new Date().toISOString(),cloudRoot:APP_FOLDER});
      toast('تم تجهيز الملف داخل نسخة '+APP_FOLDER+' بحسب السحابة المحددة.');
    };
    reader.readAsDataURL(file);
  }
  function openMenu(){var m=document.getElementById('ssCloudMenu'); if(m)m.classList.add('open');}
  function closeMenu(){var m=document.getElementById('ssCloudMenu'); if(m)m.classList.remove('open');}
  function toggleMenu(){var m=document.getElementById('ssCloudMenu'); if(m)m.classList.toggle('open');}
  function build(){/* main cloud disabled */ return;
    if(document.getElementById('ssCloudToolbar')) return;
    var el=document.createElement('div'); el.id='ssCloudToolbar'; el.className='ss-cloud-toolbar';
    el.innerHTML='<div class="ss-cloud-wrap"><button type="button" class="ss-cloud-btn" id="ssCloudToggle">☁️ التخزين السحابي</button><div class="ss-cloud-menu" id="ssCloudMenu"><div class="ss-cloud-head"><strong>إعدادات التخزين السحابي</strong><span>ينشئ ملف/مجلد باسم منصة المدرسة الرقمية الذكية ويحفظ داخله نسخة مطابقة للأقسام مع استثناء تقرير جديد وداشبورد المتابعة</span></div><button type="button" class="ss-cloud-option" data-provider="platform" data-label="حفظ داخل المنصة">💾 <span>حفظ داخل المنصة<small>يحفظ السجلات داخل النظام المحلي/السحابي للمنصة</small></span></button><button type="button" class="ss-cloud-option" data-provider="onedrive" data-label="ربط OneDrive">🔵 <span>ربط OneDrive<small>تجهيز النسخة داخل مجلد منصة المدرسة الرقمية الذكية</small></span></button><button type="button" class="ss-cloud-option" data-provider="gdrive" data-label="ربط Google Drive">🟢 <span>ربط Google Drive<small>تجهيز نسخة مطابقة للأقسام في السحابة المحددة</small></span></button><button type="button" class="ss-cloud-option" data-provider="skip" data-label="تخطي الآن">⏭️ <span>تخطي الآن<small>يمكن تفعيل التخزين السحابي لاحقًا</small></span></button><div class="ss-cloud-actions"><button type="button" class="ss-cloud-sync" id="ssCloudSync">مزامنة الآن</button><button type="button" class="ss-cloud-upload" id="ssCloudUpload">رفع ملف</button><button type="button" class="ss-cloud-package" id="ssCloudPackage">تنزيل النسخة</button><button type="button" class="ss-cloud-map" id="ssCloudMap">تنزيل الخريطة</button></div><input class="ss-cloud-file" type="file" id="ssCloudFile"><div class="ss-cloud-status" id="ssCloudStatus"></div></div></div>';
    document.body.appendChild(el);
    document.getElementById('ssCloudToggle').addEventListener('click',function(e){e.stopPropagation();toggleMenu();});
    document.querySelectorAll('.ss-cloud-option').forEach(function(btn){btn.addEventListener('click',function(){choose(btn.dataset.provider,btn.dataset.label);});});
    document.getElementById('ssCloudSync').addEventListener('click',syncNow);
    document.getElementById('ssCloudMap').addEventListener('click',downloadMap);
    document.getElementById('ssCloudPackage').addEventListener('click',downloadPackage);
    document.getElementById('ssCloudUpload').addEventListener('click',function(){document.getElementById('ssCloudFile').click();});
    document.getElementById('ssCloudFile').addEventListener('change',function(e){uploadSelectedFile(e.target.files[0]); e.target.value='';});
    document.addEventListener('click',function(e){if(!el.contains(e.target))closeMenu();});
    updateStatus();
  }
  window.SmartSchoolCloudStorage={settings:settings,setSettings:setSettings,saveCloudRecord:saveCloudRecord,syncNow:syncNow,downloadMap:downloadMap,downloadPackage:downloadPackage,structure:folderStructure,buildCloudPackage:buildCloudPackage,uploadSelectedFile:uploadSelectedFile};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build); else build();
})();


;
/* Firebase disabled: Supabase is the single cloud source for schools/users. */
window.db = null;
window.auth = { currentUser: { uid: localStorage.getItem('cached_manager_uid') || 'offline-admin' } };
window.appId = 'smart-school-supabase';
window.currentUserUid = window.auth.currentUser.uid;
window.fs = {
  doc:function(){return null;}, setDoc:async function(){return null;}, getDoc:async function(){return null;},
  updateDoc:async function(){return null;}, collection:function(){return null;}, onSnapshot:function(){return function(){};},
  query:function(){return null;}, addDoc:async function(){return null;}, deleteDoc:async function(){return null;}
};
window.ensureAuth = async function(){ return window.auth.currentUser; };
setTimeout(function(){ window.dispatchEvent(new CustomEvent('authReady')); }, 0);

/* ===== Teams AI Meeting Minutes Enhancement =====
   يضيف تعبئة محضر الاجتماع من نص/حضور Microsoft Teams عبر دالة Supabase ASK-AI.
   لا يحتوي على مفتاح OpenAI؛ المفتاح يبقى داخل Supabase Secret باسم OPENAI_API_KEY. */
(function(){
  const AI_ENDPOINT = window.SMART_SCHOOL_AI_ENDPOINT || 'https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_wrqnWejHyIhaYnMusFfDQQ_6NBvAK9N';
  const $ = (id) => document.getElementById(id);
  const setVal = (id, value) => { const el = $(id); if (el) el.value = value || ''; };
  const getVal = (id) => ($(id)?.value || '').trim();
  const toast = (msg) => { if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); };
  const status = (msg, good=false) => { const el = $('meeting-ai-status'); if (el) { el.textContent = msg; el.className = 'text-[11px] font-bold leading-6 ' + (good ? 'text-emerald-800' : 'text-slate-600'); } };
  const roleLabelLocal = (role) => ({leadership:'مدير النظام', agency:'وكيل المدرسة', performance:'معلم/ـة'}[role] || role || 'مشارك');

  async function readTeamsFile(){
    const f = $('teams-attendance-file')?.files?.[0];
    if (!f) return '';
    if (f.size > 900000) throw new Error('ملف Teams كبير جدًا. يرجى استخدام ملف TXT/CSV مختصر أو نسخ النص مباشرة.');
    return await f.text();
  }

  function selectedPlatformParticipants(){
    return [...document.querySelectorAll('.meeting-participant')].map(cb => ({
      id: cb.value,
      name: cb.dataset.name || '',
      role: cb.dataset.role || '',
      checked: !!cb.checked
    })).filter(p => p.name);
  }

  function normalizeArabicName(s){
    return String(s||'')
      .replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function applyAttendanceNames(names){
    const wanted = (names || []).map(normalizeArabicName).filter(Boolean);
    if (!wanted.length) return 0;
    let count = 0;
    document.querySelectorAll('.meeting-participant').forEach(cb => {
      const n = normalizeArabicName(cb.dataset.name || '');
      const matched = wanted.some(w => n.includes(w) || w.includes(n));
      if (matched) { cb.checked = true; count++; }
    });
    return count;
  }

  function safeJsonFromText(text){
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    try { return JSON.parse(t); } catch(e) {}
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch(e) {} }
    return null;
  }

  async function askAIForMeeting(payload){
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        task: 'teams_meeting_minutes',
        message: payload.prompt,
        data: payload
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.response || data.result || data.error || 'تعذر الاتصال بدالة الذكاء.');
    return data.response || data.result || data.answer || data.output || '';
  }

  function buildMeetingPayload(mode, teamsText){
    const platformParticipants = selectedPlatformParticipants();
    const selectedParticipants = platformParticipants.filter(p => p.checked);
    const title = getVal('meeting-title') || 'محضر اجتماع';
    const type = getVal('meeting-type') || $('meeting-type')?.value || '';
    const date = getVal('meeting-date');
    const time = getVal('meeting-time');
    const current = {
      title, type, date, time,
      teamsUrl: getVal('meeting-teams-url'),
      agenda: getVal('meeting-agenda'),
      recommendations: getVal('meeting-recommendations'),
      tasks: getVal('meeting-tasks')
    };
    const participantsList = platformParticipants.map(p => `${p.name} - ${roleLabelLocal(p.role)}${p.checked ? ' - محدد مسبقًا' : ''}`).join('\n');
    return {
      mode,
      current,
      platformParticipants,
      selectedParticipants,
      teamsText,
      prompt: `أنت مساعد محاضر اجتماعات داخل منصة القيادة المدرسية الذكية.\nالمطلوب: تحليل نص/ملف اجتماع Microsoft Teams واستخراج الحضور الفعلي وتعبئة محضر رسمي جاهز لاعتماد المدير.\n\nأعد الناتج JSON فقط دون شرح خارج JSON وبالمفاتيح التالية:\n{\n  "title": "عنوان مناسب للاجتماع",\n  "type": "نوع الاجتماع",\n  "attendees": ["أسماء الحاضرين الفعليين فقط"],\n  "absentees": ["أسماء غير حاضرين إن أمكن"],\n  "agenda": "محاور الاجتماع كنقاط واضحة",\n  "recommendations": "التوصيات والقرارات كنقاط واضحة",\n  "tasks": "المهام الناتجة: المهمة - المسؤول - تاريخ المتابعة إن وجد",\n  "approvalNote": "صيغة مختصرة للمدير للاعتماد النهائي"\n}\n\nبيانات النموذج الحالية:\n${JSON.stringify(current, null, 2)}\n\nقائمة مستخدمي المنصة المتاحين للمطابقة:\n${participantsList || 'لا توجد قائمة مستخدمين ظاهرة'}\n\nنص/ملف Teams:\n${teamsText || 'لا يوجد نص Teams، اعتمد على بيانات النموذج الحالية إن وجدت.'}`
    };
  }

  function applyMeetingAIResult(obj, rawText){
    if (obj && typeof obj === 'object') {
      if (obj.title) setVal('meeting-title', obj.title);
      if (obj.type && $('meeting-type')) {
        const sel = $('meeting-type');
        const found = [...sel.options].some(o => o.value === obj.type);
        if (found) sel.value = obj.type;
      }
      if (obj.agenda) setVal('meeting-agenda', obj.agenda);
      if (obj.recommendations) setVal('meeting-recommendations', obj.recommendations);
      if (obj.tasks) setVal('meeting-tasks', obj.tasks);
      const matched = applyAttendanceNames(obj.attendees || []);
      const note = obj.approvalNote ? '\n\nملاحظة الاعتماد: ' + obj.approvalNote : '';
      const chatInput = $('meeting-chat-input');
      if (chatInput && note.trim()) chatInput.value = note.trim();
      localStorage.setItem('ss_last_ai_meeting_minutes', JSON.stringify({ result: obj, createdAt: Date.now() }));
      status(`تمت تعبئة المحضر بالذكاء. تم تحديد ${matched} من الحضور المطابقين لحسابات المنصة. راجع المحضر ثم اضغط تجهيز لاعتماد المدير.`, true);
      toast('تمت تعبئة محضر الاجتماع بالذكاء ✅');
      return;
    }
    setVal('meeting-recommendations', rawText || 'تعذر استخراج JSON واضح من رد الذكاء.');
    status('وصل رد من الذكاء لكن لم يكن بصيغة منظمة؛ تم وضعه في خانة التوصيات للمراجعة.', true);
  }

  window.generateMeetingMinutesWithAI = async function(){
    try {
      status('جاري قراءة ملف Teams وتحليل الاجتماع بالذكاء...');
      const pasted = getVal('teams-transcript-input');
      const fileText = await readTeamsFile();
      const teamsText = [pasted, fileText].filter(Boolean).join('\n\n--- ملف Teams ---\n\n');
      if (!teamsText && !getVal('meeting-agenda') && !getVal('meeting-recommendations')) {
        toast('الصق نص الاجتماع أو ارفع ملف Teams أولًا.');
        status('لم يتم إدخال نص أو ملف Teams.');
        return;
      }
      const raw = await askAIForMeeting(buildMeetingPayload('full_minutes', teamsText));
      applyMeetingAIResult(safeJsonFromText(raw), raw);
    } catch (err) {
      status('تعذر تنفيذ تعبئة المحضر: ' + (err?.message || err));
      toast('تعذر تنفيذ تعبئة المحضر بالذكاء');
    }
  };

  window.extractTeamsAttendanceOnly = async function(){
    try {
      status('جاري استخراج الحضور الفعلي من Teams...');
      const pasted = getVal('teams-transcript-input');
      const fileText = await readTeamsFile();
      const teamsText = [pasted, fileText].filter(Boolean).join('\n');
      if (!teamsText) return toast('الصق نص الحضور أو ارفع ملف حضور Teams أولًا.');
      const payload = buildMeetingPayload('attendance_only', teamsText);
      payload.prompt = payload.prompt.replace('تحليل نص/ملف اجتماع Microsoft Teams واستخراج الحضور الفعلي وتعبئة محضر رسمي جاهز لاعتماد المدير', 'استخراج أسماء الحضور الفعليين فقط من نص/ملف Teams ومطابقتهم مع مستخدمي المنصة');
      const raw = await askAIForMeeting(payload);
      const obj = safeJsonFromText(raw);
      const attendees = obj?.attendees || [];
      const matched = applyAttendanceNames(attendees);
      status(`تم استخراج ${attendees.length} اسمًا من Teams، وتم تحديد ${matched} حسابًا مطابقًا في قائمة المشاركين.`, true);
      toast('تم استخراج الحضور الفعلي ✅');
    } catch (err) {
      status('تعذر استخراج الحضور: ' + (err?.message || err));
    }
  };

  window.markMeetingReadyForApproval = function(){
    const title = getVal('meeting-title') || 'محضر اجتماع';
    const attendees = [...document.querySelectorAll('.meeting-participant:checked')].map(cb => cb.dataset.name).filter(Boolean);
    const draft = {
      id: 'ai-approval-' + Date.now(),
      title,
      date: getVal('meeting-date'),
      time: getVal('meeting-time'),
      attendees,
      agenda: getVal('meeting-agenda'),
      recommendations: getVal('meeting-recommendations'),
      tasks: getVal('meeting-tasks'),
      teamsUrl: getVal('meeting-teams-url'),
      status: 'بانتظار اعتماد المدير',
      preparedBy: (window.currentUser && window.currentUser.name) || 'مستخدم المنصة',
      createdAt: Date.now()
    };
    const key = 'ss_ai_meeting_minutes_pending_approval';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
    list.unshift(draft);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
    status('تم تجهيز المحضر للاعتماد النهائي. يمكن للمدير مراجعته ثم استخدام زر حفظ/طباعة/إرسال.', true);
    toast('تم تجهيز المحضر لاعتماد المدير ✅');
  };
})();
