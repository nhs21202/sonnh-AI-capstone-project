package shopify

import (
	"errors"
	"net/url"

	"github.com/golang-jwt/jwt/v5"
)

// ShopFromSessionToken verifies an App Bridge session token (HS256, signed with the app secret)
// and returns the shop domain from its `dest` claim. This is the stateless admin-auth primitive:
// the shop identity comes from the SIGNED token, never from a path/query parameter.
func ShopFromSessionToken(tokenString, secret string) (string, error) {
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}

	dest, _ := claims["dest"].(string)
	if dest == "" {
		return "", errors.New("session token missing dest claim")
	}
	u, err := url.Parse(dest)
	if err != nil || u.Host == "" {
		return "", errors.New("invalid dest claim")
	}
	return u.Host, nil
}
