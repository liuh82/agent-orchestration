# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Nexus" [level=1] [ref=e5]
  - generic [ref=e6]:
    - generic [ref=e8]:
      - generic "邮箱" [ref=e10]
      - generic [ref=e14]:
        - img "mail" [ref=e16]:
          - img [ref=e17]
        - textbox "邮箱" [ref=e19]:
          - /placeholder: 请输入邮箱
    - generic [ref=e21]:
      - generic "密码" [ref=e23]
      - generic [ref=e27]:
        - img "lock" [ref=e29]:
          - img [ref=e30]
        - textbox "密码" [ref=e32]:
          - /placeholder: 请输入密码
        - img "eye-invisible" [ref=e34] [cursor=pointer]:
          - img [ref=e35]
    - button "登 录" [ref=e43] [cursor=pointer]:
      - generic [ref=e44]: 登 录
  - generic [ref=e45]:
    - text: 没有账号？
    - link "立即注册" [ref=e46] [cursor=pointer]:
      - /url: /register
```